import type { ApiConfig, ExecutionStep, RequestOptions, WorkflowStepResult } from "@superglue/client";
import { Integration, Metadata } from "@superglue/shared";
import { server_defaults } from "../default.js";
import { IntegrationManager } from "../integrations/integration-manager.js";
import { executeApiCall } from "../utils/api.js";
import { logMessage } from "../utils/logs.js";
import { applyJsonata, flattenObject, transformAndValidateSchema } from "../utils/tools.js";
import { generateTransformCode } from "../utils/transform.js";

export interface ExecutionStrategy {
  execute(
    step: ExecutionStep,
    payload: Record<string, any>,
    credentials: Record<string, string>,
    options: RequestOptions,
    metadata: Metadata,
    integration?: Integration
  ): Promise<WorkflowStepResult>;
}

export function selectStrategy(step: ExecutionStep): ExecutionStrategy {
  const strategy = step.executionMode == "LOOP" ? loopStrategy : directStrategy;
  return strategy;
}

// ======= Strategy implementations =======

const directStrategy: ExecutionStrategy = {
  async execute(
    step: ExecutionStep,
    payload: Record<string, any>,
    credentials: Record<string, string>,
    options: RequestOptions = {},
    metadata: Metadata,
    integrationManager?: IntegrationManager
  ): Promise<WorkflowStepResult> {
    const result: WorkflowStepResult = {
      stepId: step.id,
      success: false,
      config: step.apiConfig
    }
    try {
      const apiResponse = await executeApiCall({
        endpoint: step.apiConfig,
        payload,
        credentials,
        options,
        metadata,
        integrationManager
      });
      const transformedData = await applyJsonata(apiResponse.data, step.responseMapping); //LEGACY: New workflow strategy will not use respone mappings

      result.rawData = apiResponse.data;
      result.transformedData = transformedData;
      result.success = true;
      result.config = apiResponse.endpoint;

      logMessage("info", `'${step.id}' ${result.success ? "Complete" : "Failed"}`, metadata);
    } catch (error) {
      const errorMessage = `Error in direct execution for step ${step.id}: ${error}`;

      result.error = errorMessage;
      result.success = false;
      logMessage("error", errorMessage, metadata);
    }
    return result;
  },
};

const loopStrategy: ExecutionStrategy = {
  async execute(
    step: ExecutionStep,
    payload: Record<string, any>,
    credentials: Record<string, string>,
    options: RequestOptions = {},
    metadata: Metadata,
    integrationManager?: IntegrationManager
  ): Promise<WorkflowStepResult> {
    const result: WorkflowStepResult = {
      stepId: step.id,
      success: false,
      config: step.apiConfig
    }

    try {
      if (!step.loopSelector) {
        if (Array.isArray(payload)) {
          step.loopSelector = "$";
        } else {
          throw new Error("loopSelector is required for LOOP execution mode");
        }
      }

      let loopItems: any[] = [];

      // Apply loop selector using transformation validation to support both JSONata and JS
      const loopSelectorResult = await transformAndValidateSchema(payload, step.loopSelector, null);
      if (loopSelectorResult.success) {
        loopItems = Array.isArray(loopSelectorResult.data) ? loopSelectorResult.data : [];
      }

      // Regenerate selector if no items found - always generate JS going forward
      if (!Array.isArray(loopItems) || loopItems.length === 0) {
        logMessage("error", `No input data found for '${step.id}' - regenerating data selector`, metadata);

        const instruction = `Create a JavaScript function that extracts the array of items to loop over for step: ${step.id}. 
          
Step instruction: ${step.apiConfig.instruction}

The function should:
1. Extract an array of ACTUAL DATA ITEMS (not metadata or property definitions)
2. Apply any filtering based on the step's instruction

Available data in sourceData:
${Object.keys(payload).map(key => {
          const value = payload[key];
          const type = Array.isArray(value) ? `array[${value.length}]` : typeof value;
          return `- ${key}: ${type}`;
        }).join('\n')}

The function should return an array of items that this step will iterate over.`;

        const arraySchema = { type: "array", description: "Array of items to iterate over" };
        const transformResult = await generateTransformCode(arraySchema, payload, instruction, metadata);

        if (transformResult?.mappingCode) {
          step.loopSelector = transformResult.mappingCode;
          const retryResult = await transformAndValidateSchema(payload, step.loopSelector, null);
          if (retryResult.success) {
            loopItems = Array.isArray(retryResult.data) ? retryResult.data : [];
          }
        }
      }

      loopItems = loopItems.slice(0, step.loopMaxIters || server_defaults.DEFAULT_LOOP_MAX_ITERS);

      const stepResults: WorkflowStepResult[] = [];
      let successfulConfig: ApiConfig | null = null;

      for (let i = 0; i < loopItems.length; i++) {
        const currentItem = loopItems[i] || "";
        logMessage("debug", `Executing loop iteration ${i + 1}/${loopItems.length}`, metadata);

        const loopPayload: Record<string, any> = {
          ...payload,
          ...flattenObject(currentItem, 'currentItem'),
          currentItem: currentItem
        };

        try {
          const apiResponse = await executeApiCall({
            endpoint: successfulConfig || step.apiConfig,
            payload: loopPayload,
            credentials,
            options: {
              ...options,
              testMode: false
            },
            integrationManager, 
            metadata
          });

          // Store/update the successful configuration
          if (apiResponse.endpoint) {
            successfulConfig = apiResponse.endpoint;
            if (successfulConfig !== step.apiConfig) {
              logMessage("debug", `Loop iteration ${i + 1} updated configuration`, metadata);
            }
          }

          const rawData = { currentItem: currentItem, ...(typeof apiResponse.data === 'object' ? apiResponse.data : { data: apiResponse.data }) };
          const transformedData = await applyJsonata(rawData, step.responseMapping); //LEGACY: New workflow strategy will not use response mappings, default to $

          stepResults.push({
            stepId: step.id,
            success: true,
            rawData: rawData,
            transformedData: transformedData,
            config: apiResponse.endpoint
          });

          // update the apiConfig with the new endpoint
          step.apiConfig = apiResponse.endpoint;

        } catch (callError) {
          const errorMessage = `Error processing item ${i + 1}/${loopItems.length} '${JSON.stringify(currentItem).slice(0, 50)}...': ${String(callError)}`;
          logMessage("error", errorMessage, metadata);
          throw new Error(errorMessage);
        }
      }

      result.config = step.apiConfig;
      result.rawData = stepResults.map(r => r.rawData);
      result.transformedData = stepResults.map(r => r.transformedData);
      result.success = stepResults.every(r => r.success);
      result.error = stepResults.filter(s => s.error).join("\n");
    } catch (error) {
      result.config = step.apiConfig;
      result.success = false;
      result.error = error.message || error;
    }
    logMessage("info", `'${step.id}' ${result.success ? "Complete" : "Failed"}`, metadata);
    return result;
  }
};