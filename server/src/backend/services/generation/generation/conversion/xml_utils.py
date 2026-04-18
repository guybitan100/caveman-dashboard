from io import TextIOWrapper
from typing import TextIO, Any, Iterable, Generator
from xml.sax.saxutils import XMLGenerator, escape

from xsdata.exceptions import XmlWriterError
from xsdata.formats.dataclass.serializers import XmlSerializer
from xsdata.formats.dataclass.serializers.config import SerializerConfig
from xsdata.formats.dataclass.serializers.mixins import XmlWriter, XmlWriterEvent
from xsdata.formats.dataclass.serializers.writers import XmlEventWriter


class ReportXmlSerializer(XmlSerializer):
    def __init__(self, output, namespace: str):
        super().__init__()      # Super constructor call is only needed to initialize the default context (XmlContext)
        self.output = output
        self._namespace = namespace
        self._report_writer: ReportXmlWriter    # Initialized within context management

    def write_report_object(self, obj: Any):
        events = self.write_object(obj)
        self.write_events(events)

    def write_events(self, events: Iterable[tuple[str, ...]]):
        events = self._add_namespace(events)
        self._report_writer.write(events)

    def _add_namespace(self, events: Iterable[tuple[str, ...]]) -> Generator[tuple[str, ...], None, None]:
        for event in events:
            if event[0] == XmlWriterEvent.START or event[0] == XmlWriterEvent.END:
                event = (event[0], f'{{{self._namespace}}}{event[1]}')
            yield event

    def __enter__(self):
        self._report_writer = ReportXmlWriter(
            config=SerializerConfig(pretty_print=True),
            output=TextIOWrapper(self.output, write_through=True, encoding='utf-8'),
            ns_map={None: self._namespace}
        )
        self._report_writer.start_document()
        return self

    def __exit__(self, *args):
        self._report_writer.handler.endDocument()


class ReportXmlWriter(XmlEventWriter):
    def __init__(self, config: SerializerConfig, output: TextIO, ns_map: dict):
        XmlWriter.__init__(self, config, output, ns_map)

        self.current_level = 0
        self.pending_end_element = False
        self.handler = _ReportXmlGenerator(out=self.output, encoding=self.config.encoding, short_empty_elements=True)

    def write(self, events: Generator):
        for event, *args in events:
            if event == XmlWriterEvent.START:
                self.start_tag(*args)
            elif event == XmlWriterEvent.END:
                self.end_tag(*args)
            elif event == XmlWriterEvent.ATTR:
                self.add_attribute(*args)
            elif event == XmlWriterEvent.DATA:
                self.set_data(*args)
            else:
                raise XmlWriterError(f"Unhandled event: `{event}`")

    def set_data(self, data: Any):
        value = self.encode_data(data)
        self.flush_start(is_nil=value is None)

        if value:
            if not self.in_tail:
                self.handler.characters(value, cdata=True)
            else:
                self.tail = value

        self.in_tail = True


class _ReportXmlGenerator(XMLGenerator):
    def characters(self, content, cdata: bool = False):
        if content:
            self._finish_pending_start_element()
            if not isinstance(content, str):
                content = str(content, self._encoding)
            if cdata:
                self._write(f"<![CDATA[{content}]]>")
            else:
                self._write(escape(content))
