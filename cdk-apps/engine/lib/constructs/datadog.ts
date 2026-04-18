import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { DatadogLambda } from "datadog-cdk-constructs-v2";

export interface DatadogProps {
  readonly service: string;
  readonly functions?: lambda.IFunction[];
  readonly logGroups?: logs.ILogGroup[];
  environment: string;
  version: string;
  datadogApiKeySecretArn: string;
  datadogForwarderArn: string;
}

export class Datadog extends Construct {
  constructor(scope: Construct, id: string, props: DatadogProps) {
    const {
      service,
      functions,
      logGroups,
      environment,
      version,
      datadogApiKeySecretArn,
      datadogForwarderArn,
    } = props;

    super(scope, id);

    const datadogApiKeySecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "DatadogApiKeySecret",
      datadogApiKeySecretArn,
    );

    const datadogForwarderFn = lambda.Function.fromFunctionArn(
      this,
      "DatadogForwarderFn",
      datadogForwarderArn,
    );

    if (functions && functions.length > 0) {
      const datadog = new DatadogLambda(this, "DatadogConfig", {
        env: environment,
        service,
        version,
        site: "datadoghq.com",
        apiKeySecret: datadogApiKeySecret,
        forwarderArn: datadogForwarderFn.functionArn,
        logLevel: "INFO",
        addLayers: false,
        enableProfiling: true,
        flushMetricsToLogs: true,
        enableMergeXrayTraces: true,
        enableDatadogTracing: true,
        captureLambdaPayload: true,
      });

      datadog.addLambdaFunctions((functions as lambda.Function[]) || []);
    }
    if (logGroups && logGroups.length > 0) {
      const datadog = new DatadogLambda(
        this,
        "DatadogConfigurationForLogGroups",
        {
          env: environment,
          service,
          version,
          site: "datadoghq.com",
          apiKeySecret: datadogApiKeySecret,
          forwarderArn: datadogForwarderFn.functionArn,
          logLevel: "INFO",
          addLayers: false,
          enableProfiling: true,
          flushMetricsToLogs: true,
          enableMergeXrayTraces: true,
          enableDatadogTracing: true,
          captureLambdaPayload: true,
        },
      );
      datadog.addForwarderToNonLambdaLogGroups(logGroups);
    }
  }
}
