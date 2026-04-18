import * as cdk from "aws-cdk-lib";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

interface internalAlbStackProps extends NestedStackProps {
  vpc: ec2.IVpc;
  subnets: ec2.ISubnet[];
  domainName: string;
  certificateArn: string;
  vpceIps: string[];
}

export class internalAlbStack extends NestedStack {
  ALBCanonicalHostedZoneID: string;
  ALBDnsName: string;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  constructor(scope: Construct, id: string, props: internalAlbStackProps) {
    super(scope, id, props);

    const { vpc, subnets, domainName, certificateArn, vpceIps } = props;

    // Create the ALB
    this.alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc,
      vpcSubnets: { subnets },
      http2Enabled: false,
      internetFacing: false,
    });

    // Add HTTPS listener
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "Certificate",
      certificateArn,
    );

    // Add HTTP listener with redirection to HTTPS
    this.alb.addListener("HTTPListener", {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    // Add HTTPS listener
    const httpsListener = this.alb.addListener("HTTPSListener", {
      port: 443,
      certificates: [certificate],

      // Default action - last resort
      defaultAction: elbv2.ListenerAction.fixedResponse(503, {
        contentType: "text/plain",
      }),
    });

    // Add targets to the HTTPS listener
    // VPCE is REST so health check is on port 80
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc,
      port: 443,
      targets: vpceIps.map((ip) => new targets.IpTarget(ip)),
      healthCheck: {
        protocol: elbv2.Protocol.HTTP,
        path: "/",
        port: "80",
        healthyHttpCodes: "200,307,405",
      },
    });

    httpsListener.addAction("TrailingSlashRedirect", {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.hostHeaders([domainName]),
        elbv2.ListenerCondition.pathPatterns(["*/"]),
      ],
      action: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        host: "#{host}",
        port: "#{port}",
        path: "/#{path}index.html",
        query: "#{query}",
        permanent: true,
      }),
    });

    // Domain-based routing
    httpsListener.addAction("DomainForwarding", {
      priority: 15,
      conditions: [elbv2.ListenerCondition.hostHeaders([domainName])],
      action: elbv2.ListenerAction.forward([targetGroup]),
    });

    // temp prod domain warning
    const envVar = this.node.getContext("env") as string;
    if (envVar === "prod") {
      httpsListener.addAction("OldDomainWarning", {
        priority: 20,
        conditions: [
          elbv2.ListenerCondition.hostHeaders(["six.cellebrite.cto"]),
        ],
        action: elbv2.ListenerAction.fixedResponse(200, {
          contentType: "text/html",
          messageBody:
            '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cellebrite SiX Moved</title><style>body{background-color:#fff;color:#1e2c3f;font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;text-align:center;font-size:1.5rem}.container{max-width:600px}.highlight{color:#ff5300;font-weight:700}a{text-decoration:none;font-weight:700}a:hover{text-decoration:underline}</style></head><body><div class="container"><p>Cellebrite <span class="highlight">SiX</span> has moved to a new Domain. Try out <a href="https://six.ai.aws.cellebrite.local">https://six.ai.aws.cellebrite.local</a></p></div></body></html>',
        }),
      });
    }

    // Update the ALB security group to allow all outbound traffic
    const albSecurityGroups = this.alb.connections.securityGroups;

    albSecurityGroups.forEach((sg) => {
      vpceIps.forEach((ip) => {
        sg.addEgressRule(
          ec2.Peer.ipv4(ip + "/32"),
          ec2.Port.allTraffic(),
          "Allow outbound traffic to VPCE",
        );
      });
    });

    // Output the ALB DNS name
    new cdk.CfnOutput(this, "ALBDnsName", {
      value: this.alb.loadBalancerDnsName,
    });

    new cdk.CfnOutput(this, "ALBCanonicalHostedZoneID", {
      value: this.alb.loadBalancerCanonicalHostedZoneId,
    });
    this.ALBDnsName = this.alb.loadBalancerDnsName;
    this.ALBCanonicalHostedZoneID = this.alb.loadBalancerCanonicalHostedZoneId;

    const env = this.node.getContext("env") as string;
    const r53BucketName = cdk.Fn.importValue("r53BucketName");
    const r53Bucket = s3.Bucket.fromBucketName(
      this,
      "r53Bucket",
      r53BucketName,
    );
    const record = s3deploy.Source.jsonData(`six${env}.json`, {
      Changes: [
        {
          Action: "UPSERT",
          ResourceRecordSet: {
            Name: domainName,
            Type: "CNAME",
            TTL: 300,
            ResourceRecords: [
              {
                Value: this.ALBDnsName,
              },
            ],
          },
        },
      ],
    });

    // Deploy the file to the S3 bucket - This will trigger a lambda to update the Route53 records
    const deployment = new s3deploy.BucketDeployment(
      this,
      `DeploySix${env}Record`,
      {
        sources: [record],
        destinationBucket: r53Bucket,
        prune: false,
      },
    );
    deployment.node.addDependency(this.alb);
  }
}
