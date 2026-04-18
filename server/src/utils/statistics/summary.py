import hashlib
import os
import subprocess
from collections import defaultdict
from datetime import timedelta
from itertools import chain
from pathlib import Path, PurePath
from tempfile import NamedTemporaryFile
from typing import Type, List, Dict, Union, Optional, Annotated
from zipfile import ZipFile

import click
from pydantic import BaseModel, Field
from xsdata.utils.text import pascal_case

from generation.conversion.report import Event, DecodedData, TaggedFiles, File
from utils.statistics.info import get_model_info, ModelInfo, FileInfo, SourceExtractionInfo, AudioVideoFileInfo
from utils.ufdr import parser


class UfdrReportSummary(BaseModel):
    report_id: Optional[str] = None
    report_version: Optional[str]
    source_extractions: List[SourceExtractionInfo]
    model_type_to_infos: Dict[
        str,
        List[
            Annotated[
                Union[tuple(ModelInfo.__subclasses__()) + (ModelInfo,)],
                Field(discriminator="model_type"),
            ]
        ],
    ]  # this (__subclasses__()) works because all are defined in the same file
    file_infos: List[FileInfo]
    md5: str

    class Config:
        use_enum_values = True
        json_encoders = {timedelta: lambda t: int(t.total_seconds())}

    def dict(self, exclude_none=True, **kwargs):
        return super().dict(exclude_none=exclude_none, **kwargs)


@click.command()
@click.option("--input_path", "-i", help="Path to UFDR or report XML file", type=Path)
@click.option("--output_path", "-o", help="Path to statistics output file", type=Path)
def summarize(input_path: Path, output_path: Path):
    print(f'Parsing UFDR report from path "{input_path}"')
    report = parser.parse_report(path=input_path)

    print("Summarizing models...")
    model_type_to_infos = _summarize_models(decoded_data=report.decoded_data)  # Model types
    print("Summarizing files...")
    file_infos = _summarize_files(tagged_files=report.tagged_files, ufdr_path=input_path)  # Files
    print('Calculating MD5...')
    md5 = _calculate_md5_hash(input_path=input_path)

    source_extractions = [
        SourceExtractionInfo(
            device_name=ei.device_name,
            full_name_md5=hashlib.md5(ei.full_name.encode('utf-8')).hexdigest()
        )
        for ei in report.extractions.extraction_infos
    ]

    summary = UfdrReportSummary(
        report_id=report.id,
        report_version=report.version,
        source_extractions=source_extractions,
        model_type_to_infos=model_type_to_infos,
        file_infos=file_infos,
        md5=md5
    )

    print(f'Writing UFDR report summary to path "{output_path}"')
    with output_path.open("w") as out:
        out.write(summary.json())


def _summarize_models(decoded_data: DecodedData) -> Dict[str, List[ModelInfo]]:
    model_type_to_infos = defaultdict(list)
    for model_type in decoded_data.event_types:
        print(f'Summarizing model type "{model_type.type}"')
        model_type_name = model_type.type
        model_info_class = get_model_info(model_type=model_type_name)
        for model in model_type.events:
            model_info = _summarize_model_info(
                model_type=model_type_name,
                model_info_class=model_info_class,
                model=model,
            )
            if model_info is not None:
                model_type_to_infos[model_type_name].append(model_info)
    return dict(model_type_to_infos)


def _summarize_model_info(model_type: str, model_info_class: Type[ModelInfo], model: Event) -> Optional[ModelInfo]:
    try:
        fields = _serialize_model_fields(model)
        model_info = model_info_class(model_type=model_type, **fields)
        return model_info
    except Exception as e:
        print(f'Error in model "{model.id}", error={e}')
        return None


_ModelFields = Dict[str, Union[str, "_ModelFields", List["_ModelFields"]]]


def _serialize_model_fields(model: Event) -> _ModelFields:
    if model is None:
        return None

    fields = {"uid": model.id, "deleted": model.deleted_state}

    for field in model.fields:
        fields[field.name] = field.get_value()
    for field in model.multi_fields:
        if field.values:
            fields[field.name] = [v.value for v in field.values]
    for field in model.model_fields:
        fields[field.name] = _serialize_model_fields(field.event)
    for field in model.multi_model_fields:
        fields[field.name] = [_serialize_model_fields(m) for m in field.events]

    return fields


def _summarize_files(tagged_files: TaggedFiles, ufdr_path: Path) -> List[FileInfo]:
    file_infos = []
    for file in tagged_files.files:
        try:
            file_info_class = FileInfo
            fields = _serialize_file_fields(file=file)

            category = next((item.value for item in file.metadata_file.items if item.name == 'Tags'), None)
            if category == 'Audio' or category == 'Video':
                file_info_class = AudioVideoFileInfo
                print(f'Getting duration for media {file.id}... ', end='')
                duration = get_audio_duration(ufdr_path=ufdr_path, file=file)
                print(f'{duration=}')
                fields['duration'] = duration

            filepath = Path(file.path)
            file_info = file_info_class(
                uid=file.id,
                deleted=file.deleted,
                size=file.size,
                suffix=filepath.suffix[1:] or None,
                fs_dirpath=filepath.parent,
                **fields
            )
            file_infos.append(file_info)
        except Exception as e:
            print(f'Error in file "{file.id}, error={e}"')
    return file_infos


def _serialize_file_fields(file: File) -> Dict[str, str]:
    fields = {
        pascal_case(item.name): item.value
        for item in chain(file.metadata_file.items, file.metadata.items, file.access_info.timestamps)
        if item.value is not None
    }
    return fields


def _calculate_md5_hash(input_path: Path) -> str:
    # Read file in chunks in order to support large files
    with open(input_path, 'rb') as f:
        md5 = hashlib.md5()
        block_size = 1000 * 128 * md5.block_size
        while data := f.read(block_size):
            md5.update(data)
        return md5.hexdigest()


def get_audio_duration(ufdr_path: Path, file: File) -> Optional[float]:
    tmpfile = NamedTemporaryFile(delete=False)
    try:
        with ZipFile(ufdr_path) as z:
            local_path = next(item.value for item in file.metadata_file.items if item.name == 'Local Path')
            with z.open(PurePath(local_path).as_posix()) as rz:
                tmpfile.write(rz.read())
            tmpfile.close()

            ffprobe_args = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', tmpfile.name]
            p = subprocess.Popen(ffprobe_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            out, err = p.communicate()
            if p.returncode != 0:
                return None
            duration = float(out)
            return duration
    except Exception as e:
        return None
    finally:
        tmpfile.close()
        os.unlink(tmpfile.name)     # delete temp file


if __name__ == "__main__":
    summarize()
