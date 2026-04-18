import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { TitanEnvironmentVariables } from "../../types";

export interface AiGenerationStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly subnets: ec2.ISubnet[];
  readonly environment: TitanEnvironmentVariables;
  readonly dockerFilePath: string;
  domainName: string;
  certificateArn: string;
  eksClusterName: string;
  eksOidcProviderArn: string;
  eksOidcIssuerHostPath: string;
}

export class AiGenerationStack extends cdk.NestedStack {
  public readonly baseUrl: string;
  public readonly environmentVariables: TitanEnvironmentVariables;
  public readonly aiGenEcrRepo: ecr.Repository;
  public readonly litellmEcrRepo: ecr.Repository;
  public readonly aiGenIrsaRole: iam.Role;

  constructor(scope: Construct, id: string, props: AiGenerationStackProps) {
    super(scope, id);

    const {
      environment,
      domainName,
      eksOidcProviderArn,
      eksOidcIssuerHostPath,
    } = props;
    this.environmentVariables = environment;

    const eksNamespace = "titan";

    // ECR repositories for AI generation and LiteLLM images
    this.aiGenEcrRepo = new ecr.Repository(this, "AiGenEcrRepo", {
      repositoryName: "titan-ai-generation",
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.litellmEcrRepo = new ecr.Repository(this, "LitellmEcrRepo", {
      repositoryName: "titan-litellm",
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // IRSA role shared by AI generation and LiteLLM pods
    this.aiGenIrsaRole = new iam.Role(this, "AiGenIrsaRole", {
      assumedBy: new iam.FederatedPrincipal(
        eksOidcProviderArn,
        {
          StringLike: {
            [`${eksOidcIssuerHostPath}:sub`]: `system:serviceaccount:${eksNamespace}:titan-ai-generation*`,
          },
          StringEquals: {
            [`${eksOidcIssuerHostPath}:aud`]: "sts.amazonaws.com",
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
    });

    this.aiGenIrsaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:*"],
        resources: ["*"],
      }),
    );
    this.aiGenIrsaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
        resources: ["*"],
      }),
    );
    this.aiGenIrsaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:*"],
        resources: ["*"],
      }),
    );
    this.aiGenIrsaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "aws-marketplace:ViewSubscriptions",
          "aws-marketplace:Subscribe",
        ],
        resources: ["*"],
      }),
    );

    // The baseUrl is now the domain served by the ALB Ingress Controller in EKS
    this.baseUrl = "https://" + domainName;

    new cdk.CfnOutput(this, "BaseUrl", {
      value: this.baseUrl,
    });
    new cdk.CfnOutput(this, "AiGenEcrRepoUri", {
      value: this.aiGenEcrRepo.repositoryUri,
    });
    new cdk.CfnOutput(this, "LitellmEcrRepoUri", {
      value: this.litellmEcrRepo.repositoryUri,
    });
    new cdk.CfnOutput(this, "AiGenIrsaRoleArn", {
      value: this.aiGenIrsaRole.roleArn,
    });
  }
}
