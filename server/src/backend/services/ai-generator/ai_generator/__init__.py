"""AI Generator - Story generation pipeline for SiX.

Main entry point is the Pipeline class.

Example:
    from ai_generator import Pipeline

    pipeline = Pipeline()
    session_id, result = await pipeline.run("A detective investigating a murder")
"""

from ai_generator.pipeline import Pipeline

__all__ = ["Pipeline"]
