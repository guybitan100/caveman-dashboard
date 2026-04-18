
import io
import logging
from enum import Enum
from typing import Optional

from ai_generator.generators.base import (
    BaseMediaGenerator,
    GenerationResult,
    MediaGenerationError,
)
from ai_generator.services.s3_uploader import get_s3_uploader

logger = logging.getLogger(__name__)


class DocumentFormat(str, Enum):
    
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"


class DocumentGenerator(BaseMediaGenerator):
    
    DEFAULT_FORMAT = DocumentFormat.PDF
    
    async def generate(
        self,
        story_id: str,
        prompt: str,
        title: Optional[str] = None,
        format: DocumentFormat = DEFAULT_FORMAT,
        **kwargs,
    ) -> GenerationResult:
        # Normalize format to DocumentFormat enum
        if isinstance(format, str):
            try:
                format = DocumentFormat(format.lower())
            except ValueError:
                raise MediaGenerationError(
                    f"Invalid document format: {format}. Must be one of: pdf, docx, txt",
                    story_id=story_id,
                    retryable=False,
                )
        
        self.logger.info(f"Generating {format} document for story {story_id}")
        
        try:
            s3_uploader = get_s3_uploader()
            
            # Generate the document bytes
            if format == DocumentFormat.PDF:
                doc_bytes = self._generate_pdf(prompt, title)
            elif format == DocumentFormat.DOCX:
                doc_bytes = self._generate_docx(prompt, title)
            else:  # TXT
                doc_bytes = self._generate_txt(prompt, title)
            
            # Upload to S3
            upload_result = await s3_uploader.upload_document(
                document_bytes=doc_bytes,
                job_id=self.job_id,
                story_id=story_id,
                format=format.value,
            )
            
            # Build filename
            file_name = f"generated_document_{story_id[:8]}.{format.value}"
            
            self.logger.info(f"Document generated successfully: {upload_result.s3_key}")
            
            return GenerationResult.from_upload(
                story_id=story_id,
                upload_result=upload_result,
                file_name=file_name,
            )
            
        except Exception as e:
            error_msg = f"Document generation failed for story {story_id}: {str(e)}"
            self.logger.error(error_msg)
            raise MediaGenerationError(error_msg, story_id=story_id)
    
    def _generate_pdf(self, content: str, title: Optional[str] = None) -> bytes:
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        except ImportError:
            raise MediaGenerationError(
                "reportlab not installed. Run: pip install reportlab",
                retryable=False,
            )
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        story = []
        
        # Add title if provided
        if title:
            title_style = ParagraphStyle(
                'Title',
                parent=styles['Heading1'],
                fontSize=18,
                spaceAfter=20,
            )
            story.append(Paragraph(title, title_style))
            story.append(Spacer(1, 12))
        
        # Add content paragraphs
        for paragraph in content.split('\n\n'):
            if paragraph.strip():
                story.append(Paragraph(paragraph.strip(), styles['Normal']))
                story.append(Spacer(1, 12))
        
        doc.build(story)
        return buffer.getvalue()
    
    def _generate_docx(self, content: str, title: Optional[str] = None) -> bytes:
        try:
            from docx import Document
            from docx.shared import Pt
        except ImportError:
            raise MediaGenerationError(
                "python-docx not installed. Run: pip install python-docx",
                retryable=False,
            )
        
        doc = Document()
        
        # Add title if provided
        if title:
            heading = doc.add_heading(title, level=1)
            heading.runs[0].font.size = Pt(18)
        
        # Add content paragraphs
        for paragraph in content.split('\n\n'):
            if paragraph.strip():
                doc.add_paragraph(paragraph.strip())
        
        buffer = io.BytesIO()
        doc.save(buffer)
        return buffer.getvalue()
    
    def _generate_txt(self, content: str, title: Optional[str] = None) -> bytes:
        lines = []
        
        if title:
            lines.append(title)
            lines.append("=" * len(title))
            lines.append("")
        
        lines.append(content)
        
        return "\n".join(lines).encode("utf-8")
    
    def _build_prompt(self, story_context: dict) -> str:
        # For documents, we typically use the full description
        content = story_context.get("body", "")
        if not content:
            content = story_context.get("user_description", "")
        
        return content
