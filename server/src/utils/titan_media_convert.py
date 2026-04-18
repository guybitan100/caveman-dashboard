import json
from pathlib import Path
import boto3
import os
import glob

"""
    Ffmpeg Codecs:
    D.AIL. qdm2                 QDesign Music Codec 2
    D.AIL. qdmc                 QDesign Music
    DEAIL. ra_144               RealAudio 1.0 (14.4K) (decoders: real_144 ) (encoders: real_144 )
    D.AIL. ra_288               RealAudio 2.0 (28.8K) (decoders: real_288 )
    D.AI.S ralf                 RealAudio Lossless
    DEAIL. roq_dpcm             DPCM id RoQ
    DEAI.S s302m                SMPTE 302M
    DEAIL. sbc                  SBC (low-complexity subband codec)
    D.AIL. sdx2_dpcm            DPCM Squareroot-Delta-Exact
    D.AI.S shorten              Shorten
    D.AIL. sipr                 RealAudio SIPR / ACELP.NET
    D.AIL. siren                Siren
    D.AIL. smackaudio           Smacker audio (decoders: smackaud )
    ..AIL. smv                  SMV (Selectable Mode Vocoder)
    D.AIL. sol_dpcm             DPCM Sol
    DEAI.. sonic                Sonic
    .EAI.. sonicls              Sonic lossless
    DEAIL. speex                Speex (decoders: speex libspeex ) (encoders: libspeex )
    D.A..S tak                  TAK (Tom's lossless Audio Kompressor)
    DEA..S truehd               TrueHD
    D.AIL. truespeech           DSP Group TrueSpeech
    DEAI.S tta                  TTA (True Audio)
    D.AIL. twinvq               VQF TwinVQ
    D.AIL. vmdaudio             Sierra VMD audio
    DEAIL. vorbis               Vorbis (decoders: vorbis libvorbis ) (encoders: vorbis libvorbis )
    D.AI.. wavesynth            Wave synthesis pseudo-codec
    DEAILS wavpack              WavPack
    D.AIL. westwood_snd1        Westwood Audio (SND1) (decoders: ws_snd1 )
    D.AI.S wmalossless          Windows Media Audio Lossless
    D.AIL. wmapro               Windows Media Audio 9 Professional
    DEAIL. wmav1                Windows Media Audio 1
    DEAIL. wmav2                Windows Media Audio 2
    D.AIL. wmavoice             Windows Media Audio Voice
    D.AIL. xan_dpcm             DPCM Xan
    D.AIL. xma1                 Xbox Media Audio 1
    D.AIL. xma2                 Xbox Media Audio 2
    ..D... bin_data             binary data
    ..D... dvd_nav_packet       DVD Nav packet
    ..D... epg                  Electronic Program Guide
    ..D... klv                  SMPTE 336M Key-Length-Value (KLV) metadata
    ..D... mpegts               raw MPEG-TS stream
    ..D... otf                  OpenType font
    ..D... scte_35              SCTE 35 Message Queue
    ..D... timed_id3            timed ID3 metadata
    ..D... ttf                  TrueType font
    ..S... arib_caption         ARIB STD-B24 caption
    DES... ass                  ASS (Advanced SSA) subtitle (decoders: ssa ass ) (encoders: ssa ass )
    DES... dvb_subtitle         DVB subtitles (decoders: dvbsub ) (encoders: dvbsub )
    D.S... dvb_teletext         DVB teletext (decoders: libzvbi_teletextdec )
    DES... dvd_subtitle         DVD subtitles (decoders: dvdsub ) (encoders: dvdsub )
    D.S... eia_608              EIA-608 closed captions (decoders: cc_dec )
    D.S... hdmv_pgs_subtitle    HDMV Presentation Graphic Stream subtitles (decoders: pgssub )
    ..S... hdmv_text_subtitle   HDMV Text subtitle
    D.S... jacosub              JACOsub subtitle
    D.S... microdvd             MicroDVD subtitle
    DES... mov_text             MOV text
    D.S... mpl2                 MPL2 subtitle
    D.S... pjs                  PJS (Phoenix Japanimation Society) subtitle
    D.S... realtext             RealText subtitle
    D.S... sami                 SAMI subtitle
    ..S... srt                  SubRip subtitle with embedded timing
    ..S... ssa                  SSA (SubStation Alpha) subtitle
    D.S... stl                  Spruce subtitle format
    DES... subrip               SubRip subtitle (decoders: srt subrip ) (encoders: srt subrip )
    D.S... subviewer            SubViewer subtitle
    D.S... subviewer1           SubViewer v1 subtitle
    DES... text                 raw UTF-8 text
    .ES... ttml                 Timed Text Markup Language
    D.S... vplayer              VPlayer subtitle
    DES... webvtt               WebVTT subtitle
    DES... xsub                 XSUB

    Codecs for each extension
    Audio:
    Mp3 = 'mp3'
    Aac = 'aac'
    Ogg = 'ogg'
    Silk = 'silk'
    Opus = 'opus'
    Wav = 'wav'
    M4a = 'm4a'
    Aif = 'aif'
    Aiff = 'aiff'
    Wma = 'wma'
    Caf = 'caf'

    Video:
    Mp4 = 'mp4'
    Mpg = 'mpg'
    Mpeg = 'mpeg'
    Mov = 'mov'
    Avi = 'avi'
    X3gp = '3gp'
    X3g2 = '3g2'
    Mkv = 'mkv'
    Wmv = 'wmv'
    M4v = 'm4v'
    Vob = 'vob'
    Mts = 'mts'
    Asf = 'asf'

    Image:
    Jpg = 'jpg'
    Jpeg = 'jpeg'
    Gif = 'gif'
    Png = 'png'
    Bmp = 'bmp'
    Webp = 'webp'

"""

def lambda_handler(event, context):
    # event_body = json.loads(event['body'])
    event_body = event
    try:
        input_file = event_body["input_file"]
        output_format = event_body["output_format"]
        filename = download_file(Path(input_file))
        convert_file(output_format, filename)
        s3_key = upload_file(output_format, filename)
    except Exception as e:
        return {"statusCode": 500, "body": str(e)}
    finally:
        cleanup_temp()
    return {"statusCode": 200, "body": s3_key}

def convert_file(output_format: str, filename: Path) -> Path:
    output = Path("/tmp/", f"{filename.stem}.{output_format}")
    os.system(f"/opt/python/ffmpeg -i {str(filename)} {str(output)}")
    print(f"Converted {filename} to {output}")
    return output

def upload_file(output_format: str, filename: Path):
    s3_client = boto3.client("s3")
    s3_key = f"{filename.stem}.{output_format}"
    s3_client.upload_file(str(filename), "ufdr-generator", s3_key)
    return s3_key

def download_file(s3_key: Path) -> Path:
    s3_client = boto3.client("s3")
    filename = Path("/tmp/", s3_key.name)
    with open(str(filename), "wb") as f:
        s3_client.download_fileobj("ufdr-generator", str(s3_key), f)
    return filename

def cleanup_temp():
    files = glob.glob("/tmp/*")
    for f in files:
        os.remove(f)
