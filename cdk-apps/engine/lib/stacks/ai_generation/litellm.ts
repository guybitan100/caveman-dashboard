import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecspatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface LiteLlmProps {
  readonly cluster: ecs.Cluster;
  readonly subnets: ec2.ISubnet[];
  readonly vpc: ec2.IVpc;
  readonly dockerFilePath: string;
}

export class LiteLlm extends Construct {
  readonly baseUrl: string;
  readonly apiKey: string = "sk-1234"; // Must match master_key in config.yaml

  constructor(scope: Construct, id: string, props: LiteLlmProps) {
    super(scope, id);

    const { cluster, subnets, vpc, dockerFilePath } = props;

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "FargateTaskDefinition",
      {
        cpu: 4096,
        memoryLimitMiB: 8192,
        family: "litellm",
      },
    );

    taskDefinition.addContainer("LiteLlmContainer", {
      containerName: "litellm",
      image: ecs.ContainerImage.fromAsset(dockerFilePath, {
        file: "./docker/llm_gateway.ecs.Dockerfile",
      }),
      command: ["--port", "80", "--config", "config.yaml"],
      environment: {},
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "litellm",
      }),
      portMappings: [
        {
          containerPort: 80,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["bedrock:*"],
        resources: ["*"],
      }),
    );
    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["logs:CreateLogStream"],
        resources: ["*"],
      }),
    );
    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "aws-marketplace:ViewSubscriptions",
          "aws-marketplace:Subscribe",
        ],
        resources: ["*"],
      }),
    );

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      loadBalancerName: "litellm-alb",
      vpc,
      internetFacing: false,
      vpcSubnets: { subnets },
      idleTimeout: cdk.Duration.minutes(30),
    });

    const service = new ecspatterns.ApplicationLoadBalancedFargateService(
      this,
      "Service",
      {
        serviceName: "litellm-service",
        cluster,
        taskSubnets: { subnets },
        loadBalancer,
        desiredCount: 2,
        platformVersion: ecs.FargatePlatformVersion.LATEST,
        circuitBreaker: { enable: true, rollback: true },
        healthCheckGracePeriod: cdk.Duration.seconds(60),
        taskDefinition,
      },
    );

    service.targetGroup.configureHealthCheck({
      path: "/",
    });

    this.baseUrl = "http://" + service.loadBalancer.loadBalancerDnsName;

    new cdk.CfnOutput(this, "BaseUrl", {
      value: this.baseUrl,
    });
  }
}
