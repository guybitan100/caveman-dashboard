import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { LiteLlm } from "./litellm";
import { TitanEnvironmentVariables } from "../../types";

export interface AiGenerationStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly subnets: ec2.ISubnet[];
  readonly environment: TitanEnvironmentVariables;
  readonly dockerFilePath: string;
  domainName: string;
  certificateArn: string;
}

export class AiGenerationStack extends cdk.NestedStack {
  public readonly baseUrl: string;
  public readonly environmentVariables: TitanEnvironmentVariables;

  constructor(scope: Construct, id: string, props: AiGenerationStackProps) {
    super(scope, id);

    const {
      vpc,
      subnets,
      environment,
      dockerFilePath,
      domainName,
      certificateArn,
    } = props;
    this.environmentVariables = environment;

    const cluster = new ecs.Cluster(this, "AiGenerationCluster", {
      vpc,
      clusterName: "titan-ai-generation-cluster",
    });

    const litellm = new LiteLlm(this, "LiteLlm", {
      cluster,
      subnets,
      vpc,
      dockerFilePath,
    });

    const sg = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });
    sg.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
    sg.connections.allowFromAnyIpv4(ec2.Port.tcp(443));
    sg.connections.allowFromAnyIpv4(ec2.Port.icmpPing());

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "FargateTaskDef",
      {
        cpu: 2048,
        memoryLimitMiB: 4096,
        runtimePlatform: {
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
        },
      },
    );

    taskDefinition.addContainer("AiGenerationContainer", {
      containerName: "genai-container",
      image: ecs.ContainerImage.fromAsset(dockerFilePath, {
        file: "./docker/ai_generation.ecs.Dockerfile",
      }),
      environment: {
        TITAN_LITELLM_BASE_URL: litellm.baseUrl,
        TITAN_LITELLM_API_KEY: litellm.apiKey,
        TITAN_MEDIA_GENERATION_BATCH_SIZE: "5",
        TITAN_MEDIA_GENERATION_ENABLED: true.toString(),
        TITAN_MEDIA_GENERATION_RETRY_ATTEMPTS: "3",
        TITAN_VERSION: "1.0.0",
        ...this.environmentVariables,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "titan-genai",
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
      portMappings: [
        {
          containerPort: 80,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });
    taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:*"],
        resources: ["*"],
      }),
    );
    taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["logs:CreateLogStream"],
        resources: ["*"],
      }),
    );
    taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:*"],
        resources: ["*"],
      }),
    );

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      loadBalancerName: "titan-ai-generation-alb",
      vpc,
      internetFacing: false,
      vpcSubnets: { subnets },
      idleTimeout: cdk.Duration.minutes(30),
      securityGroup: sg,
    });

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "Certificate",
      certificateArn,
    );

    loadBalancer.addListener("HTTPListener", {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    const httpsListener = loadBalancer.addListener("HTTPSListener", {
      port: 443,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(503, {
        contentType: "text/plain",
      }),
    });

    // Create target group for the ECS service
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/health",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // Create Fargate service directly (without the pattern that creates its own listener)
    const service = new ecs.FargateService(this, "Service", {
      serviceName: "titan-ai-generation-service",
      cluster,
      taskDefinition,
      vpcSubnets: { subnets },
      securityGroups: [sg],
      desiredCount: 1,
      platformVersion: ecs.FargatePlatformVersion.LATEST,
      circuitBreaker: { enable: true, rollback: true },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    // Attach service to target group
    service.attachToApplicationTargetGroup(targetGroup);

    httpsListener.addAction("DomainForwarding", {
      priority: 15,
      conditions: [elbv2.ListenerCondition.hostHeaders([domainName])],
      action: elbv2.ListenerAction.forward([targetGroup]),
    });

    const originalBaseUrl = "http://" + loadBalancer.loadBalancerDnsName;

    this.baseUrl = "https://" + domainName; // https://titanai-backend.ai.aws.cellebrite.local

    new cdk.CfnOutput(this, "OriginalBaseUrl", {
      value: originalBaseUrl,
    });

    new cdk.CfnOutput(this, "BaseUrl", {
      value: this.baseUrl,
    });
  }
}
