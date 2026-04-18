import { Construct } from "constructs";
import { DatadogECSFargate } from "datadog-cdk-constructs-v2";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";

export interface DatadogEcsProps {
  service?: string;
  environment: string;
  version: string;
  datadogApiKeySecretArn: string;
}

export class DatadogEcs extends Construct {
  public readonly ecs: DatadogECSFargate;
  public readonly datadogApiKeySecret: secrets.ISecret;

  constructor(scope: Construct, id: string, props: DatadogEcsProps) {
    super(scope, id);

    const {
      service = "six",
      environment: env,
      version,
      datadogApiKeySecretArn,
    } = props;

    this.datadogApiKeySecret = secrets.Secret.fromSecretCompleteArn(
      this,
      "DatadogApiKeySecret",
      datadogApiKeySecretArn,
    );

    this.ecs = new DatadogECSFargate({
      apiKeySecret: this.datadogApiKeySecret,
      isDatadogDependencyEnabled: true,
      environmentVariables: {
        DD_CONTAINER_EXCLUDE: "name:datadog-agent",
      },
      dogstatsd: {
        isEnabled: true,
      },
      apm: {
        isEnabled: true,
      },
      logCollection: {
        isEnabled: true,
        fluentbitConfig: {
          logDriverConfig: {
            serviceName: service,
            sourceName: "six",
          },
          firelensOptions: {
            isParseJson: true,
          },
        },
      },
      env,
      version,
      service,
    });
  }
}
