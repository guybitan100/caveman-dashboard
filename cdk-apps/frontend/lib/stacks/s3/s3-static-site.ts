import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { execSync, ExecSyncOptions } from "child_process";

interface S3StaticSiteStackProps extends NestedStackProps {
  bucketName: string;
  vpcEndpointId: string;
  repoRoot: string;
  apiUrl: string;
  metafinderUrl: string;
  aiGenerationUrl: string;
  websocketEndpoint: string;
  websocketApiKey: string;
}

export class S3StaticSiteStack extends NestedStack {
  constructor(scope: Construct, id: string, props: S3StaticSiteStackProps) {
    super(scope, id, props);

    const { bucketName, vpcEndpointId, repoRoot, apiUrl, metafinderUrl } =
      props;

    // Create an S3 bucket
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: bucketName,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Add a bucket policy to allow access only from CloudFront
    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "VPCEndpointAccess",
        actions: ["s3:GetObject"],
        resources: [siteBucket.arnForObjects("*")],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          StringEquals: {
            "aws:SourceVpce": vpcEndpointId,
          },
        },
      }),
    );

    // Deploy site contents to S3 bucket with bundling
    const rootPath = path.join(__dirname, repoRoot);
    const frontendPath = path.join(rootPath, "src/frontend");
    const execOptions: ExecSyncOptions = {
      stdio: ["ignore", process.stderr, "inherit"],
      env: {
        ...process.env,
        VITE_TITAN_API_URL: apiUrl,
        VITE_METAFINDER_HOST: metafinderUrl,
        VITE_WS_ENDPOINT: props.websocketEndpoint,
        VITE_WS_API_KEY: props.websocketApiKey,
        VITE_AI_GENERATOR_URL: props.aiGenerationUrl,
      },
    };

    new s3deploy.BucketDeployment(this, "DeployWithInvalidation", {
      sources: [
        s3deploy.Source.asset(frontendPath, {
          assetHash: `${Date.now()}`,
          bundling: {
            image: cdk.DockerImage.fromRegistry("node:22.13"),
            user: "root",
            local: {
              tryBundle(outputDir: string) {
                try {
                  execSync("node --version", execOptions);
                } catch {
                  return false;
                }

                try {
                  execSync(`npm ci --legacy-peer-deps`, {
                    ...execOptions,
                    cwd: frontendPath,
                  });
                  execSync(`npm run build`, {
                    ...execOptions,
                    cwd: frontendPath,
                  });
                  execSync(
                    `cp -r ${path.join(frontendPath, "dist")}/* ${path.join(outputDir)}`,
                    {
                      ...execOptions,
                    },
                  );
                  return true;
                } catch (e) {
                  console.error("Error during bundling:", e);
                  return false;
                }
              },
            },
          },
        }),
      ],
      destinationBucket: siteBucket,
    });
  }
}
