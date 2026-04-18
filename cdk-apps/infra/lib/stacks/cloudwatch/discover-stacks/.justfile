#!/usr/bin/env just --justfile

# Set shell for non-Windows OSs:
set shell := ["/bin/bash", "-c"]

# Default recipe to display help information
default:
	@echo "-=== Easy Management Using Justfile ===-"
	@sleep 0.1
	@echo
	@echo "Initiating chooser...."
	@sleep 0.1
	@just --choose

# Run-all
all: env && clean install check run

# Set env
env:
    echo "Setting up the environment..."
    pyenv local 3.13
    python --version

# Run the Python script
run:
    echo "Running the Python script..."
    python -m poetry run python discover_stacks.py

lint:
    echo "Running lint checks with Ruff..."
    python -m poetry run ruff format

# Type check with mypy
type-check:
    echo "Running type checks with mypy..."
    python -m poetry run mypy discover_stacks.py

# Format code with black
format:
    echo "Formatting code with black..."
    python -m poetry run black discover_stacks.py

# Install dependencies with Poetry
install:
    echo "Installing dependencies with Poetry..."
    python -m pip install --upgrade pip
    python -m pip install poetry
    python -m poetry install

export:
    echo "Exporting the environment..."
    python -m poetry export -f requirements.txt --output requirements.txt

# Full check: lint, type-check, and format
check:
    just lint
    just type-check
    just format

# Clean cache (optional)
clean:
    echo "Cleaning .pyc files and cache..."
    find . -name "*.pyc" -delete
    find . -name "__pycache__" -delete
    find . -name ".mypy_cache" -delete
    find . -name ".pytest_cache" -delete
    find . -name ".ruff_cache" -delete
    find ./ -type d -exec rm -r {} + 2>/dev/null || true

# Help command to display available tasks
help:
    echo "Available commands:"
    echo "  just all         - Run all tasks"
    echo "  just run         - Run the Python script"
    echo "  just lint        - Run lint checks with flake8"
    echo "  just type-check  - Run type checks with mypy"
    echo "  just format      - Format code with black"
    echo "  just install     - Install dependencies with Poetry"
    echo "  just check       - Run lint, type-check, and format"
    echo "  just clean       - Clean .pyc files and cache"

