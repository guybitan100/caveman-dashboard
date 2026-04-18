import { Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { internalAlbStack } from "./stacks/alb/internal-alb";
import { S3StaticSiteStack } from "./stacks/s3/s3-static-site";

interface EngineSSMOutputs {
  apiUrl: string;
  metafinderUrl: string;
  aiGenerationUrl: string;
  websocketEndpoint: string;
  websocketApiKey: string;
}

interface FrontendStackProps extends StackProps, EnvContext {}

class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const {
      vpcId,
      subnetIds,
      hostedZoneName,
      certificateArn,
      s3VpcEndpointId,
      s3VpceIps,
      repoRoot,
      engineSSMParameter,
    } = props;
    const vpcEndpointId = s3VpcEndpointId;
    const vpceIps = s3VpceIps;

    const env = this.node.getContext("env") as string;

    let domainName = "";
    if (env === "prod") {
      domainName = `titan.${hostedZoneName}`;
    } else {
      domainName = `titan${env}.${hostedZoneName}`;
    }
    console.log("Domain Name: ", domainName);

    const vpc = ec2.Vpc.fromLookup(this, "VPC", {
      vpcId,
    });

    const subnets = subnetIds.map((subnetId) =>
      ec2.Subnet.fromSubnetId(this, subnetId, subnetId),
    );

    const combinedEngineOutputs = ssm.StringParameter.valueFromLookup(
      this,
      `${engineSSMParameter}/${env}`,
    );

    // Parse the JSON to extract the individual secret ARNs
    // Ternary check to handle the dummy context value
    const outputs = combinedEngineOutputs.startsWith("dummy-value")
      ? {
          apiUrl: "https://dummy-api-url.com",
          metafinderUrl: "https://dummy-metafinder-url.com",
          aiGenerationUrl: "https://dummy-generator-url.com",
          websocketEndpoint: "wss://dummy-websocket-endpoint.com",
          websocketApiKey: "dummy-webscoket-api-key",
        }
      : (JSON.parse(combinedEngineOutputs) as EngineSSMOutputs);
    console.log("Outputs: ", outputs);

    // Internal ALB
    new internalAlbStack(this, "InternalALBStack", {
      vpc,
      subnets,
      domainName,
      certificateArn,
      vpceIps,
    });

    // S3 Static Site
    new S3StaticSiteStack(this, "S3StaticSiteStack", {
      bucketName: domainName,
      vpcEndpointId,
      repoRoot,
      apiUrl: outputs.apiUrl,
      metafinderUrl: outputs.metafinderUrl,
      aiGenerationUrl: outputs.aiGenerationUrl,
      websocketEndpoint: outputs.websocketEndpoint,
      websocketApiKey: outputs.websocketApiKey,
    });

    new cdk.CfnOutput(this, "FrontendURL", {
      value: `https://${domainName}`,
      description: "The URL of the frontend",
    });
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface EnvContext {
  environment: string;
  vpcId: string;
  subnetIds: string[];
  r53RoleArn: string;
  hostedZoneId: string;
  hostedZoneName: string;
  certificateArn: string;
  s3VpcEndpointId: string;
  s3VpceIps: string[];
  repoRoot: string;
  engineSSMParameter: string;
}

interface FrontendEnvProps extends StackProps {
  context: EnvContext;
}

export class frontendEnv extends Construct {
  constructor(scope: Construct, id: string, props: FrontendEnvProps) {
    super(scope, id);

    const env = this.node.getContext("env") as string;
    console.log("Termination Protection: ", env === "prod");

    new FrontendStack(this, "FrontendStack", {
      env: props.env,
      terminationProtection: env === "prod", // Enable termination protection for prod environment
      ...props.context,
    });
  }
}
