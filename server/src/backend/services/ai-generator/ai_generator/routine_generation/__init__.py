"""Routine story generation package.

This package generates routine/ambient phone activity stories using
LLM-generated weekly templates with randomization.
"""

from ai_generator.routine_generation.generator import generate_routine_stories

__all__ = ["generate_routine_stories"]
