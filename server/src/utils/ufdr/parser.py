from pathlib import Path
from typing import Union, BinaryIO
from zipfile import ZipFile

from xsdata.formats.dataclass.parsers.config import ParserConfig
from xsdata.formats.dataclass.parsers import XmlParser

from generation.conversion.report import Report


_parser = XmlParser(config=ParserConfig(fail_on_unknown_properties=False))


def parse_report_from_xml_file(xml_file: Union[str, Path, BinaryIO]) -> Report:
    if isinstance(xml_file, Path):
        xml_file = str(xml_file)
    report = _parser.parse(xml_file, Report)
    return report


def parse_report_from_ufdr_file(ufdr_path: Union[str, Path]) -> Report:
    with ZipFile(ufdr_path) as z:
        with z.open("report.xml") as r:
            return parse_report_from_xml_file(r)


def parse_report(path: Union[str, Path]) -> Report:
    if isinstance(path, str):
        path = Path(path)

    if path.suffix == ".ufdr":
        return parse_report_from_ufdr_file(path)
    elif path.suffix == ".xml":
        return parse_report_from_xml_file(path)
    else:
        raise Exception("File must be a UFDR or XML file")
