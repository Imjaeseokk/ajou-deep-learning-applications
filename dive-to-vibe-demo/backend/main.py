from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from typing import Optional, List 
from pydantic import BaseModel, Field
import json
import os
import urllib.parse # URL 인코딩/디코딩을 위해 추가

# FastAPI 애플리케이션 초기화
app = FastAPI()

# 정적 파일 서빙 설정
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# 분석 데이터가 저장된 디렉토리 경로
ANALYSIS_DATA_DIR = "backend/analysis_data"

# Pydantic 모델은 이전과 동일하게 유지됩니다.
class AudioTimestampData(BaseModel):
    timestamp_ms: int
    valence: float
    arousal: float

class AudioAnalysis(BaseModel):
    song_title: str
    artist: Optional[str] = Field(default="Unknown Artist") # artist 필드를 Optional로 변경
    overall_va: Optional[dict] = Field(default=None)         # overall_va 필드를 Optional로 변경
    time_series_va: List[AudioTimestampData] # chunked_va 대신 time_series_va 사용


class LyricsChunk(BaseModel):
    chunk_id: int
    lyrics_text: str
    valence: float
    arousal: float
    dominance: float

class LyricsAnalysis(BaseModel):
    artist: str
    overall_vad: dict
    chunked_vad: list[LyricsChunk]

class AnalysisResult(BaseModel):
    song_title: str
    artist: str
    audio_path: Optional[str] = None 
    lyrics_analysis: Optional[LyricsAnalysis] = None
    audio_analysis: Optional[AudioAnalysis] = None

# CORS 설정
from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5500", # Live Server (VS Code 확장) 등 프론트엔드 개발 서버 포트
    "http://127.0.0.1:5500"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 루트 엔드포인트: 프론트엔드 HTML 파일 제공
@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("frontend/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

# API 엔드포인트: 모든 노래 목록 반환 (song_title로 구분)
# @app.get("/api/songs") 함수 전체를 아래 코드로 교체
@app.get("/api/songs")
async def get_songs():
    songs_found = {} # 중복 방지를 위해 딕셔너리 사용

    for filename in os.listdir(ANALYSIS_DATA_DIR):
        if filename.endswith(("_lyrics.json", "_audio.json")): # <-- 둘 다 확인하도록 수정
            base_filename = filename.replace("_lyrics.json", "").replace("_audio.json", "")
            song_title_from_file_name = urllib.parse.unquote(base_filename).replace("_", " ")

            current_song_data = songs_found.get(base_filename, {"title": song_title_from_file_name, "artist": "Unknown Artist"})

            try:
                file_path = os.path.join(ANALYSIS_DATA_DIR, filename)
                with open(file_path, "r", encoding="utf-8") as f:
                    file_content = json.load(f)

                if "song_title" in file_content: # _audio.json에 song_title이 있다면
                    current_song_data["title"] = file_content["song_title"]
                if "artist" in file_content: # _audio.json이나 _lyrics.json에 artist가 있다면
                    current_song_data["artist"] = file_content["artist"]
                
                songs_found[base_filename] = current_song_data

            except json.JSONDecodeError:
                print(f"Error decoding JSON for {filename}")
                continue
            except Exception as e:
                print(f"Unexpected error processing {filename}: {e}")
                continue
    
    return list(songs_found.values())

# API 엔드포인트: 특정 노래의 분석 데이터 반환 (song_title로 구분)
@app.get("/api/analyze/{song_title}", response_model=AnalysisResult)
async def analyze_song(song_title: str):
    song_title_for_file = urllib.parse.quote(song_title).replace("%20", "_")

    audio_file_path = os.path.join(ANALYSIS_DATA_DIR, f"{song_title_for_file}_audio.json")
    lyrics_file_path = os.path.join(ANALYSIS_DATA_DIR, f"{song_title_for_file}_lyrics.json")

    loaded_audio_analysis = None
    loaded_lyrics_analysis = None
    
    found_song_title = song_title_for_file.replace("_", " ")
    found_artist = "Unknown Artist"

    # 오디오 분석 데이터 로드 시도
    if os.path.exists(audio_file_path):
        try:
            with open(audio_file_path, "r", encoding="utf-8") as f:
                audio_raw_data = json.load(f)
            loaded_audio_analysis = AudioAnalysis(**audio_raw_data)
            
            # 오디오 파일에서 song_title과 artist를 가져옴 (있다면)
            found_song_title = loaded_audio_analysis.song_title # AudioAnalysis는 song_title을 필수로 가짐
            if loaded_audio_analysis.artist: # Optional이므로 존재 여부 확인
                found_artist = loaded_audio_analysis.artist
            
        except (json.JSONDecodeError, ValueError) as e:
            print(f"경고: 오디오 파일 '{audio_file_path}' 로드 중 오류 발생: {e}")
        except Exception as e:
            print(f"경고: 오디오 파일 '{audio_file_path}' 처리 중 예상치 못한 오류 발생: {e}")

    # 가사 분석 데이터 로드 시도
    if os.path.exists(lyrics_file_path):
        try:
            with open(lyrics_file_path, "r", encoding="utf-8") as f:
                lyrics_raw_data = json.load(f)
            loaded_lyrics_analysis = LyricsAnalysis(**lyrics_raw_data)
            
            # 가사 파일에서 artist를 가져옴 (있다면)
            if loaded_lyrics_analysis.artist and found_artist == "Unknown Artist": # lyrics 파일의 artist가 Unknown Artist일 경우에만 업데이트
                 found_artist = loaded_lyrics_analysis.artist
            
        except (json.JSONDecodeError, ValueError) as e:
            print(f"경고: 가사 파일 '{lyrics_file_path}' 로드 중 오류 발생: {e}")
        except Exception as e:
            print(f"경고: 가사 파일 '{lyrics_file_path}' 처리 중 예상치 못한 오류 발생: {e}")

    if loaded_audio_analysis is None and loaded_lyrics_analysis is None:
        raise HTTPException(status_code=404, detail=f"Analysis data for '{song_title}' not found (neither audio nor lyrics).")

    result_data = {
        "song_title": found_song_title,
        "artist": found_artist,
        "audio_path": f"/static/audio/{song_title}.mp3" if loaded_audio_analysis else None

    }
    if loaded_lyrics_analysis is not None:
        result_data["lyrics_analysis"] = loaded_lyrics_analysis
    if loaded_audio_analysis is not None:
        result_data["audio_analysis"] = loaded_audio_analysis

    return AnalysisResult(**result_data)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)