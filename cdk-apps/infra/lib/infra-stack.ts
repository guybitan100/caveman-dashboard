import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { r53Stack } from "./stacks/r53/r53";
import { docDB } from "./stacks/docdb/docdb";
import { CloudWatchEventBridgeStack } from "./stacks/cloudwatch/cloudwatch";
import { Athena } from "./stacks/athena/athena";

interface InfraStackProps extends StackProps, EnvContext {}

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    const {
      vpcId,
      subnetCidrRegex,
      securityGroupName,
      r53RoleArn,
      hostedZoneId,
      ssmOutputsParameterName,
      metafinderMetadataBucketName,
    } = props;

    const vpc = ec2.Vpc.fromLookup(this, "VPC", {
      vpcId: vpcId,
    });

    // Create a regex from the string in the config
    const cidrRegex = new RegExp(subnetCidrRegex);
    const vpcSubnets = {
      subnets: vpc.privateSubnets.filter((subnet) => {
        const matches = cidrRegex.test(subnet.ipv4CidrBlock);
        console.log(
          `Subnet ${subnet.subnetId} with CIDR ${subnet.ipv4CidrBlock} matches: ${matches}`,
        );
        return matches;
      }),
    };

    // Security group for our resources
    const securityGroup = ec2.SecurityGroup.fromLookupByName(
      this,
      "ExistingSg",
      securityGroupName,
      vpc,
    );

    //##################################################################
    // AWS Route53 Managment
    //##################################################################
    const r53 = new r53Stack(this, "r53Stack", {
      vpc,
      roleArn: r53RoleArn,
      hostedZoneId: hostedZoneId,
    });
    const r53Bucket = r53.r53Bucket;
    if (!r53Bucket) {
      throw new Error(
        "r53Bucket is not defined. Please ensure it is properly initialized.",
      );
    }

    //##################################################################
    // DocumentDB
    //##################################################################
    const docDb = new docDB(this, "docDB", {
      vpc: vpc,
      vpcSubnets: vpcSubnets,
      securityGroup: securityGroup,
      ssmOutputsParameterName,
      r53Bucket,
    });

    const documentDBClusterEndpoint = docDb.documentDBClusterEndpoint;
    const documentDBClusterReaderEndpoint =
      docDb.documentDBClusterReaderEndpoint;
    const documentDBCredentialsSecret = docDb.documentDBCredentialsSecret;
    const documentDBCredentialsSecretArn = docDb.documentDBCredentialsSecretArn;

    //###################################################################
    // Athena
    //##################################################################

    new Athena(this, "Athena", {
      metafinderMetadataBucketName,
    });

    //#################################################################
    // SSM Parameter Store
    //##################################################################
    // Combine the imported values into a single JSON object
    const combinedOutputs = {
      documentDBClusterEndpoint,
      documentDBClusterReaderEndpoint,
      documentDBCredentialsSecret,
      documentDBCredentialsSecretArn,
    };

    // Push the combined values into a single SSM parameter
    new ssm.StringParameter(this, "infraStackOutputs", {
      parameterName: ssmOutputsParameterName,
      stringValue: JSON.stringify(combinedOutputs),
      description: "Combined outputs from the nested stack",
    });

    //##################################################################
    // CloudWatch Dashboard + EventBridge
    //##################################################################
    new CloudWatchEventBridgeStack(this, "CloudWatchEventBridgeStack", {});
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface EnvContext {
  vpcId: string;
  subnetCidrRegex: string;
  securityGroupName: string;
  r53RoleArn: string;
  hostedZoneId: string;
  ssmOutputsParameterName: string;
  metafinderMetadataBucketName: string;
}

interface InfraEnvProps extends StackProps {
  context: EnvContext;
}

export class InfraEnv extends Construct {
  constructor(scope: Construct, id: string, props: InfraEnvProps) {
    super(scope, id);

    const env = this.node.getContext("env") as string;
    console.log("Termination Protection: ", env === "prod");

    new InfraStack(this, "InfraStack", {
      env: props.env,
      terminationProtection: env === "prod", // Enable termination protection for prod environment
      ...props.context,
    });
  }
}
