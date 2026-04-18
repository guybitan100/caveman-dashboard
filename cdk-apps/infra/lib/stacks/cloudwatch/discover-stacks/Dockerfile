FROM public.ecr.aws/lambda/python:3.13

# Lambda task root dir, automatically set by Lambda
# ENV LAMBDA_TASK_ROOT /var/task

# Copy requirements.txt
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install the specified packages
RUN pip install -r requirements.txt

# Copy function code
COPY discover_stacks.py ${LAMBDA_TASK_ROOT}/main.py

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "main.handler" ]
