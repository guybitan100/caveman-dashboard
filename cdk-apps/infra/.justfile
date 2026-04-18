#!/usr/bin/env just --justfile

# Set shell for non-Windows OSs:
set shell := ["/bin/bash", "-c"]

# Set defualts
account := "339712891490"
region := "eu-central-1"
version := "2.0.9"

# Default recipe to display help information
default:
	@echo "-=== Easy Management Using Justfile ===-"
	@sleep 0.1
	@echo
	@echo "Initiating chooser...."
	@sleep 0.1
	@just --choose

# Run all CDK operations: bootstrap and deploy
cdk-all ARG:
	@echo "Running all CDK operations..."
	@just cdk-bootstrap {{ARG}}
	@just cdk-test
	@just cdk-synth {{ARG}}
	@just cdk-diff {{ARG}}
	@just cdk-deploy {{ARG}}

# Initialize the CDK module in a specified directory
cdk-init ARG:
	@echo "Creating and initializing CDK project in directory: {{ARG}}"
	mkdir -p {{ARG}}
	cd {{ARG}} && cdk init app --language typescript


# Bootstrap the CDK environment
cdk-bootstrap ARG:
	@echo "Bootstrapping CDK environment..."
	cdk bootstrap aws://"{{account}}"/"{{region}}" \
		--context account="{{account}}" \
		--context region="{{region}}" \
		--context env={{ARG}} \
		--context version="{{version}}" \
		--trust "{{account}}" \
		--cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess

# Run tests
cdk-test:
	@echo "Testing CDK stack..."
	npm test

# Synthize the CDK stack into CloudFormation template
cdk-synth ARG:
	@echo "Synthizing CDK stack..."
	cdk synth \
		--context account="{{account}}" \
		--context region="{{region}}" \
		--context env={{ARG}} \
		--context version="{{version}}"

cdk-diff ARG:
	@echo "Diffing CDK stack..."
	cdk diff \
		--context account="{{account}}" \
		--context region="{{region}}" \
		--context env={{ARG}} \
		--context version="{{version}}"

# Deploy the CDK stack
cdk-deploy ARG:
	@echo "Deploying CDK stack..."
	cdk deploy \
		--context account="{{account}}" \
		--context region="{{region}}" \
		--context env={{ARG}} \
		--context version="{{version}}" \
		--all \
		--require-approval never

# Destroy the CDK stack
cdk-destroy ARG:
	@echo "Destroying CDK stack..."
	cdk destroy \
		--context account="{{account}}" \
		--context region="{{region}}" \
		--context env={{ARG}} \
		--context version="{{version}}" \
		--all \
		--force
