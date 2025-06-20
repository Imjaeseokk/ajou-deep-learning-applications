document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소들을 JavaScript 변수로 가져옵니다.
    const songSelect = document.getElementById('song-select');
    const selectedSongInfo = document.getElementById('selected-song-info');
    const analysisResultsSection = document.getElementById('analysis-results');

    // 오디오 분석 섹션과 관련된 요소들
    // .result-card:nth-of-type(1)은 HTML에서 첫 번째 .result-card를 의미합니다.
    const audioSection = document.querySelector('.result-card:nth-of-type(1)'); 
    const overallAudioVa = document.getElementById('overall-audio-va');
    const audioVaPlotDiv = document.getElementById('audio-va-plot');

    // 가사 분석 섹션과 관련된 요소들
    // .result-card:nth-of-type(2)는 HTML에서 두 번째 .result-card를 의미합니다.
    const lyricsSection = document.querySelector('.result-card:nth-of-type(2)'); 
    const overallLyricsVad = document.getElementById('overall-lyrics-vad');
    const displayedLyrics = document.getElementById('displayed-lyrics');
    const lyricsVadPlotDiv = document.getElementById('lyrics-vad-plot');
    const lyricsHoverDisplay = document.getElementById('lyrics-hover-display');

    // 오디오 컨트롤 요소
    const audioPlayer = document.getElementById('audioPlayer');
    const playPauseButton = document.getElementById('playPauseButton');
    const audioProgressBar = document.getElementById('audioProgressBar');
    const currentTime = document.getElementById('currentTime');
    const duration = document.getElementById('duration');



    // 백엔드 API의 기본 URL 설정
    // 개발 환경에서 Live Server (예: 5500)를 사용하는 경우, 백엔드 (8000) 주소를 명시적으로 지정합니다.
    const API_BASE_URL = 'http://127.0.0.1:8000'; 
    // 만약 FastAPI가 직접 프론트엔드를 서빙하고 있다면 (uvicorn main:app --app-dir ./backend),
    // window.location.origin; 을 사용해도 됩니다.
    // const API_BASE_URL = window.location.origin;

    // 현재 선택된 노래의 가사 청크 데이터를 저장할 변수 (호버 기능에 사용)
    let currentLyricsData = []; 

    /**
     * 백엔드에서 노래 목록을 가져와 드롭다운 메뉴를 채웁니다.
     */
    async function fetchSongs() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/songs`);
            // HTTP 응답이 성공적인지 확인 (status 200-299)
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const songs = await response.json();

            // 노래 목록이 비어있을 경우 메시지 표시
            if (songs.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "불러올 노래가 없습니다.";
                songSelect.appendChild(option);
            } else {
                // 노래 목록을 드롭다운 옵션으로 추가
                songs.forEach(song => {
                    const option = document.createElement('option');
                    option.value = song.title; // 옵션의 값은 노래 제목
                    option.textContent = `${song.title} - ${song.artist}`; // 사용자에게 보여질 텍스트
                    songSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Failed to fetch songs:", error);
            alert(`노래 목록을 불러오는 데 실패했습니다. 서버가 실행 중인지, CORS 설정이 올바른지 확인하세요.\n오류: ${error.message}`);
        }
    }

    /**
     * 화면의 분석 결과 표시 영역을 초기 상태로 재설정합니다.
     */
    function resetDisplay() {
        // 전체 결과 섹션을 숨깁니다.
        analysisResultsSection.style.display = 'none';
        selectedSongInfo.textContent = '없음';

        // 오디오 섹션 초기화
        audioSection.style.display = 'block'; // 섹션 자체는 보이지만 내용이 없을 수 있음
        overallAudioVa.textContent = ''; // 전체 감성 요약 텍스트 초기화
        Plotly.purge(audioVaPlotDiv); // Plotly 그래프 제거 및 이벤트 리스너 해제
        audioVaPlotDiv.innerHTML = '<p style="text-align: center; color: #888; padding-top: 150px;"></p>'; // 그래프 영역에 메시지 표시

        // 가사 섹션 초기화
        lyricsSection.style.display = 'block'; // 섹션 자체는 보이지만 내용이 없을 수 있음
        overallLyricsVad.textContent = ''; // 전체 감성 요약 텍스트 초기화
        displayedLyrics.innerHTML = ''; // 전체 가사 텍스트 초기화
        Plotly.purge(lyricsVadPlotDiv); // Plotly 그래프 제거 및 이벤트 리스너 해제
        lyricsVadPlotDiv.innerHTML = '<p style="text-align: center; color: #888; padding-top: 150px;"></p>'; // 그래프 영역에 메시지 표시
        lyricsHoverDisplay.innerHTML = '<p>그래프에 마우스를 올리면<br>해당 청크의 가사가 표시됩니다.</p>'; // 호버 박스 초기 메시지
        
        currentLyricsData = []; // 가사 데이터 초기화
    }

    /**
     * 드롭다운 메뉴에서 노래 선택 시 분석 데이터를 가져와 표시합니다.
     */
    songSelect.addEventListener('change', async (event) => {
        const songTitle = event.target.value; // 선택된 노래의 제목 (value 속성)
        
        resetDisplay(); // 새로운 노래 선택 시 화면 초기화

        // "노래를 선택하세요" 옵션이 선택된 경우 (value가 빈 문자열)
        if (!songTitle) {
            return; 
        }

        selectedSongInfo.textContent = `"${songTitle}" 분석 중...`; // 분석 진행 중 메시지

        try {
            // 노래 제목을 URL에 안전하게 포함하기 위해 인코딩
            const encodedSongTitle = encodeURIComponent(songTitle);
            const response = await fetch(`${API_BASE_URL}/api/analyze/${encodedSongTitle}`);
            
            // HTTP 응답이 성공적인지 확인
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json(); // JSON 응답 파싱
            
            // API 응답은 정상이나, 오디오/가사 분석 데이터가 모두 없는 경우
            if (!data.audio_analysis && !data.lyrics_analysis) {
                 selectedSongInfo.textContent = `"${data.song_title}" 분석 데이터 없음`;
                 alert(`"${data.song_title}"에 대한 분석 데이터를 찾을 수 없습니다.`);
                 return; 
            }

            if (data.audio_path) { // API 응답에 audio_path가 있다고 가정
                audioPlayer.src = `${API_BASE_URL}${data.audio_path}`; // 예: http://127.0.0.1:8000/static/audio/song.mp3
                audioPlayer.load(); // 오디오 파일 로드
            }

            // 노래 제목과 아티스트 정보 표시 업데이트
            selectedSongInfo.textContent = `${data.song_title} - ${data.artist}`;
            // 가사 호버 기능을 위해 가사 청크 데이터를 저장
            currentLyricsData = data.lyrics_analysis ? data.lyrics_analysis.chunked_vad : []; 
            
            // 분석 결과를 화면에 표시하고 그래프를 그립니다.
            displayAnalysisResults(data);
            analysisResultsSection.style.display = 'block'; // 분석 완료 후 전체 결과 섹션 표시

        } catch (error) {
            console.error(`Failed to fetch analysis for "${songTitle}":`, error);
            alert(`"${songTitle}" 노래의 분석 데이터를 불러오는 데 실패했습니다: ${error.message}`);
            selectedSongInfo.textContent = '불러오기 실패'; // 오류 메시지 표시
        }
    });

    /**
     * 백엔드에서 받아온 분석 데이터를 웹 페이지에 표시하고 Plotly 그래프로 시각화합니다.
     * @param {object} data - 백엔드 API에서 반환된 분석 데이터 객체
     */
    function displayAnalysisResults(data) {
        // --- 오디오 분석 결과 표시 ---
        if (data.audio_analysis) {
            audioSection.style.display = 'block'; // 오디오 섹션 전체를 보이게
            
            // overall_va (전체 감성) 데이터가 존재할 경우에만 텍스트 업데이트
            if (data.audio_analysis.overall_va) {
                overallAudioVa.textContent = `Valence: ${data.audio_analysis.overall_va.valence.toFixed(2)}, Arousal: ${data.audio_analysis.overall_va.arousal.toFixed(2)}`;
            } else {
                overallAudioVa.textContent = '전체 감성 정보 없음'; // 데이터가 없는 경우
            }

            // 오디오 데이터 (time_series_va)의 최소/최대값 찾기 (Y축 범위 동적 설정용)
            const audioValences = data.audio_analysis.time_series_va.map(d => d.valence);
            const audioArousals = data.audio_analysis.time_series_va.map(d => d.arousal);
            const allAudioValues = [...audioValences, ...audioArousals];
            
            // Math.min/max는 빈 배열에 대해 Infinity/-Infinity를 반환하므로, 배열이 비어있는지 확인
            const minAudioVal = allAudioValues.length > 0 ? Math.min(...allAudioValues) : -1.0; // 기본값 -1.0
            const maxAudioVal = allAudioValues.length > 0 ? Math.max(...allAudioValues) : 1.0; // 기본값 1.0

            const audioYAxisRangeMin = minAudioVal - 0.1; // 최소값보다 0.1 낮게 설정
            const audioYAxisRangeMax = maxAudioVal + 0.1; // 최대값보다 0.1 높게 설정

            // Plotly 오디오 그래프 데이터 정의
            const audioTrace = {
                // x축: timestamp_ms를 1000으로 나누어 초(second) 단위로 변환
                x: data.audio_analysis.time_series_va.map(d => d.timestamp_ms / 1000), 
                y: data.audio_analysis.time_series_va.map(d => d.valence),
                mode: 'lines+markers', // 선과 마커를 모두 표시
                name: 'Valence', // 범례 이름
                line: { color: 'rgb(255, 99, 71)' } // 그래프 색상 (밝은 빨강)
            };
            const audioTrace2 = {
                x: data.audio_analysis.time_series_va.map(d => d.timestamp_ms / 1000), 
                y: data.audio_analysis.time_series_va.map(d => d.arousal),
                mode: 'lines+markers',
                name: 'Arousal',
                line: { color: 'rgb(54, 162, 235)' } // 그래프 색상 (밝은 파랑)
            };
            // Plotly 오디오 그래프 레이아웃 정의
            const audioLayout = {
                title: `오디오 Valence-Arousal 변화 (${data.song_title})`, // 그래프 제목
                xaxis: { title: 'Time (sec)' }, // X축 제목
                yaxis: { title: 'Score (-1 ~ 1)', range: [audioYAxisRangeMin, audioYAxisRangeMax] }, // 동적 Y축 범위
                hovermode: 'closest', // 마우스 커서에 가장 가까운 데이터 포인트에 툴팁 표시
                margin: { t: 50, b: 50, l: 50, r: 50 }, // 그래프 여백
                showlegend: true // 범례 표시
            };
            // 오디오 그래프 그리기
            Plotly.newPlot(audioVaPlotDiv, [audioTrace, audioTrace2], audioLayout);
        
            audioVaPlotDiv.on('plotly_click', (eventData) => {
            // 클릭된 포인트의 x좌표(시간)를 가져옵니다.
                const clickedTime = eventData.points[0].x;
                
                // 오디오 플레이어의 재생 위치를 클릭된 시간으로 설정
                audioPlayer.currentTime = clickedTime;
                
                // 오디오 재생
                audioPlayer.play();
            });
        
        } else {
            audioSection.style.display = 'none'; // 오디오 데이터가 없으면 섹션 전체 숨기기
            // resetDisplay 함수에서 이미 초기화 메시지와 purge를 처리함
        }

        // --- 가사 분석 결과 표시 ---
        if (data.lyrics_analysis) {
            lyricsSection.style.display = 'block'; // 가사 섹션 전체를 보이게
            // 전체 감성 요약 텍스트 업데이트
            overallLyricsVad.textContent = `Valence: ${data.lyrics_analysis.overall_vad.valence.toFixed(2)}, Arousal: ${data.lyrics_analysis.overall_vad.arousal.toFixed(2)}, Dominance: ${data.lyrics_analysis.overall_vad.dominance.toFixed(2)}`;
            
            // 전체 가사 텍스트를 청크별로 합쳐서 표시
            const lyricsChunksFullText = data.lyrics_analysis.chunked_vad.map(chunk => chunk.lyrics_text);
            displayedLyrics.innerHTML = lyricsChunksFullText.join('<br><br>');

            // 가사 데이터 (chunked_vad)의 최소/최대값 찾기 (Y축 범위 동적 설정용)
            const lyricsValences = data.lyrics_analysis.chunked_vad.map(d => d.valence);
            const lyricsArousals = data.lyrics_analysis.chunked_vad.map(d => d.arousal);
            const lyricsDominances = data.lyrics_analysis.chunked_vad.map(d => d.dominance);
            const allLyricsValues = [...lyricsValences, ...lyricsArousals, ...lyricsDominances];

            // Math.min/max는 빈 배열에 대해 Infinity/-Infinity를 반환하므로, 배열이 비어있는지 확인
            const minLyricsVal = allLyricsValues.length > 0 ? Math.min(...allLyricsValues) : 1.0; // 기본값 1.0
            const maxLyricsVal = allLyricsValues.length > 0 ? Math.max(...allLyricsValues) : 5.0; // 기본값 5.0

            const lyricsYAxisRangeMin = minLyricsVal - 0.1;
            const lyricsYAxisRangeMax = maxLyricsVal + 0.1;

            // Plotly 가사 그래프 데이터 정의
            const lyricsTrace = {
                x: data.lyrics_analysis.chunked_vad.map(d => d.chunk_id),
                y: data.lyrics_analysis.chunked_vad.map(d => d.valence),
                mode: 'lines+markers',
                name: 'Valence',
                line: { color: 'rgb(255, 99, 71)' }
            };
            const lyricsTrace2 = {
                x: data.lyrics_analysis.chunked_vad.map(d => d.chunk_id),
                y: data.lyrics_analysis.chunked_vad.map(d => d.arousal),
                mode: 'lines+markers',
                name: 'Arousal',
                line: { color: 'rgb(54, 162, 235)' }
            };
            const lyricsTrace3 = {
                x: data.lyrics_analysis.chunked_vad.map(d => d.chunk_id),
                y: data.lyrics_analysis.chunked_vad.map(d => d.dominance),
                mode: 'lines+markers',
                name: 'Dominance',
                line: { color: 'rgb(75, 192, 192)' }
            };
            // Plotly 가사 그래프 레이아웃 정의
            const lyricsLayout = {
                title: `가사 Valence-Arousal-Dominance 변화 (${data.song_title})`,
                xaxis: { title: 'Chunk ID', dtick: 1 }, // X축 제목 및 정수 눈금
                yaxis: { title: 'Score (1 ~ 5)', range: [lyricsYAxisRangeMin, lyricsYAxisRangeMax] }, // 동적 Y축 범위
                hovermode: 'closest',
                margin: { t: 50, b: 50, l: 50, r: 50 },
                showlegend: true
            };
            // 가사 그래프 그리기
            Plotly.newPlot(lyricsVadPlotDiv, [lyricsTrace, lyricsTrace2, lyricsTrace3], lyricsLayout);

            // --- 가사 그래프 호버 이벤트 리스너 추가 ---
            // 마우스가 그래프 위에 올라왔을 때 (plotly_hover 이벤트)
            lyricsVadPlotDiv.on('plotly_hover', (eventData) => {
                // 이벤트 데이터에 포인트 정보가 있고, 최소 하나 이상의 포인트가 있는 경우
                if (eventData.points && eventData.points.length > 0) {
                    const point = eventData.points[0]; // 첫 번째 포인트 정보 가져오기
                    const chunkId = point.x; // 포인트의 x좌표 (청크 ID)

                    // 현재 가사 데이터에서 해당 청크 ID에 맞는 데이터를 찾기
                    const hoveredChunk = currentLyricsData.find(chunk => chunk.chunk_id === chunkId);
                    
                    if (hoveredChunk) {
                        // 호버된 청크의 가사 내용을 lyricsHoverDisplay에 표시
                        lyricsHoverDisplay.innerHTML = `<p>${hoveredChunk.lyrics_text}</p>`;
                    }
                }
            });

            // 마우스가 그래프 영역을 벗어났을 때 (plotly_unhover 이벤트)
            lyricsVadPlotDiv.on('plotly_unhover', () => {
                // lyricsHoverDisplay를 초기 메시지로 되돌림
                lyricsHoverDisplay.innerHTML = '<p>그래프에 마우스를 올리면<br>해당 청크의 가사가 표시됩니다.</p>';
            });
        } else {
            lyricsSection.style.display = 'none'; // 가사 데이터가 없으면 섹션 전체 숨기기
            // resetDisplay 함수에서 이미 초기화 메시지와 purge를 처리함
        }
    }

    // --- 오디오 플레이어 컨트롤 이벤트 리스너 ---

    // 재생/일시정지 버튼 클릭 이벤트
    playPauseButton.addEventListener('click', () => {
        // 오디오가 멈춰있으면 재생하고, 재생 중이면 멈춥니다.
        if (audioPlayer.paused) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
        }
    });

    // audioPlayer 요소에서 발생하는 이벤트를 감지합니다.
    // 1. 오디오가 '재생' 상태가 될 때
    audioPlayer.addEventListener('play', () => {
        playPauseButton.textContent = '❚❚ 일시정지';
    });

    // 2. 오디오가 '일시정지' 상태가 될 때
    audioPlayer.addEventListener('pause', () => {
        playPauseButton.textContent = '▶ 재생';
    });

    // 3. 오디오 재생이 끝났을 때
    audioPlayer.addEventListener('ended', () => {
        playPauseButton.textContent = '▶ 재생';
        audioProgressBar.value = 0; // 진행 바를 처음으로 되돌림
    });

    // 4. 오디오의 길이 등 메타데이터가 로드되었을 때 (총 시간 표시용)
    audioPlayer.addEventListener('loadedmetadata', () => {
        duration.textContent = formatTime(audioPlayer.duration);
        audioProgressBar.max = audioPlayer.duration; // 진행 바의 최대값을 오디오 총 길이로 설정
    });

    // 5. 오디오의 현재 재생 시간이 바뀔 때마다 (계속 실행됨)
    audioPlayer.addEventListener('timeupdate', () => {
        currentTime.textContent = formatTime(audioPlayer.currentTime);
        audioProgressBar.value = audioPlayer.currentTime; // 진행 바의 현재 위치 업데이트
    });

    // 6. 사용자가 진행 바(ProgressBar)를 직접 조작할 때
    audioProgressBar.addEventListener('input', () => {
        audioPlayer.currentTime = audioProgressBar.value;
    });


    /**
     * 초(seconds)를 '분:초' (m:ss) 형식의 문자열로 변환하는 헬퍼 함수
     * @param {number} seconds - 변환할 시간(초)
     * @returns {string} - 'm:ss' 형식의 시간 문자열
     */
    function formatTime(seconds) {
        // NaN(Not a Number) 값이 들어오는 경우를 방지
        if (isNaN(seconds)) {
            return '0:00';
        }
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        // padStart(2, '0')는 5초 -> "05"처럼 항상 두 자리를 유지하도록 만듭니다.
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // 페이지 로드 완료 시 초기 화면 설정 및 노래 목록 불러오기
    resetDisplay();
    fetchSongs();
});