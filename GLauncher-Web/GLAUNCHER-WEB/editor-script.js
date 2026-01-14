document.addEventListener('DOMContentLoaded', () => {
    // --- Selectores de Elementos ---
    const mediaUpload = document.getElementById('media-upload');
    const mainEditorSection = document.getElementById('main-editor-section');
    const mediaBin = document.getElementById('media-bin');
    const sourceVideo = document.getElementById('source-video');
    const musicTrackPlayer = document.getElementById('music-track-player');
    const canvas = document.getElementById('video-canvas');
    const ctx = canvas.getContext('2d');

    // Controles
    const saveProjectBtn = document.getElementById('save-project-btn');
    const applyEffectBtn = document.getElementById('apply-effect-btn');
    const toolCutBtn = document.getElementById('tool-cut-btn');
    const toolDeleteBtn = document.getElementById('tool-delete-btn');
    const toolMuteBtn = document.getElementById('tool-mute-btn');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const downloadBtn = document.getElementById('download-btn');
    const timeline = document.getElementById('timeline-slider');
    const currentTimeEl = document.getElementById('current-time');
    const durationTimeEl = document.getElementById('duration-time');
    const processingOverlay = document.getElementById('processing-overlay');

    // Navegación
    const sidebarBtns = document.querySelectorAll('.sidebar-btn');
    const editorSections = document.querySelectorAll('.editor-section');
    const mobileTabBtns = document.querySelectorAll('.mobile-tab-btn');
    const editorPanels = document.querySelectorAll('.editor-panel');

    // Línea de tiempo
    const timelinePlayhead = document.getElementById('timeline-playhead');
    const videoTrack = document.getElementById('video-track');
    const audioTrack = document.getElementById('audio-track');

    // Búsqueda de Música
    const musicSearchInput = document.getElementById('music-search-input');
    const musicSearchBtn = document.getElementById('music-search-btn');
    const musicResultsContainer = document.getElementById('music-results');

    // --- Estado del Editor ---
    let animationFrameId;
    let isPlaying = false;
    let mediaFiles = []; // Almacenará todos los archivos subidos
    let videoClips = [];
    let audioClips = []; // Almacenará los clips de audio en la línea de tiempo
    let selectedClip = null; // El clip actualmente seleccionado en la línea de tiempo
    let PIXELS_PER_SECOND = 20; // Aumentado para mejor visibilidad

    // --- Lógica de Navegación de la Barra Lateral ---
    sidebarBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSectionId = btn.dataset.section;
            
            sidebarBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            editorSections.forEach(section => {
                section.classList.toggle('active', section.id === targetSectionId);
            });

            mainEditorSection.classList.toggle('active', targetSectionId === 'main-editor-section');
            document.querySelector('.editor-grid').style.display = (targetSectionId === 'main-editor-section') ? 'grid' : 'none';
            });
        });
    });

    // --- Carga de Medios ---
    mediaUpload.addEventListener('change', (e) => {
        for (const file of e.target.files) {
            addMediaToBin(file);
        }
        // Cambiar a la sección del editor después de subir
        document.querySelector('.sidebar-btn[data-section="main-editor-section"]').click();
    });

    function addMediaToBin(file) {
        mediaFiles.push(file);

        if (mediaBin.querySelector('.empty-bin-text')) {
            mediaBin.innerHTML = ''; // Limpiar texto inicial
        }

        const isVideo = file.type.startsWith('video/');
        const iconClass = isVideo ? 'fas fa-video' : 'fas fa-volume-up';
        const itemTypeClass = isVideo ? 'video' : 'audio-file';

        const mediaItemEl = document.createElement('div');
        mediaItemEl.className = `media-item ${itemTypeClass}`;
        mediaItemEl.innerHTML = `<i class="${iconClass}"></i> <span class="media-item-name">${file.name}</span>`;
        mediaItemEl.draggable = true; // Hacer el elemento arrastrable
        mediaItemEl.dataset.fileName = file.name;
        mediaItemEl.dataset.fileType = isVideo ? 'video' : 'audio';
        
        mediaItemEl.addEventListener('click', () => {
            if (isVideo) {
                loadVideoForPreview(file);
                if (!videoClips.find(clip => clip.file.name === file.name)) {
                    addVideoToTimeline(file);
                }
            } else {
                // Lógica para cargar audio en la línea de tiempo (futuro)
                alert(`Cargando audio: ${file.name}`);
            }
        });

        mediaItemEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', file.name);
            e.dataTransfer.effectAllowed = 'copy';
        });

        mediaBin.appendChild(mediaItemEl);

        // Si es el primer video, cargarlo automáticamente en el preview
        if (isVideo && !sourceVideo.src) {
            loadVideoForPreview(file);
        }
    }

    function loadVideoForPreview(file) {
        const url = URL.createObjectURL(file);
        sourceVideo.src = url;
    }

    sourceVideo.addEventListener('loadedmetadata', () => {
        canvas.width = sourceVideo.videoWidth;
        canvas.height = sourceVideo.videoHeight;
        // Ajustar el tamaño del canvas manteniendo la proporción
        const aspectRatio = sourceVideo.videoWidth / sourceVideo.videoHeight;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        timeline.value = 0;
        sourceVideo.currentTime = 0;
        drawFrame();
        enableControls();
        durationTimeEl.textContent = formatTime(sourceVideo.duration);
    });

    function enableControls() {
        document.querySelectorAll('.control-btn').forEach(btn => btn.disabled = false);
    }

    // --- Controles de Reproducción ---
    function drawFrame() {
        ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
    }

    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    function updateTimeline() {
        timeline.value = (sourceVideo.currentTime / sourceVideo.duration) * 100;
        currentTimeEl.textContent = formatTime(sourceVideo.currentTime);
        timelinePlayhead.style.left = `${10 + (sourceVideo.currentTime * PIXELS_PER_SECOND)}px`;
    }

    function play() {
        isPlaying = true;
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        function loop() {
            if (!sourceVideo.paused && !sourceVideo.ended) {
                drawFrame();
                updateTimeline();
                animationFrameId = requestAnimationFrame(loop);
            } else {
                pause();
            }
        }
        sourceVideo.play();
        loop();
    }

    function pause() {
        isPlaying = false;
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        sourceVideo.pause();
        cancelAnimationFrame(animationFrameId);
    }

    playPauseBtn.addEventListener('click', () => {
        isPlaying ? pause() : play();
    });

    timeline.addEventListener('input', () => {
        pause();
        const time = (timeline.value / 100) * sourceVideo.duration;
        sourceVideo.currentTime = time;
        drawFrame();
        currentTimeEl.textContent = formatTime(time);
        updateTimeline();
    });

    // --- Lógica de Exportación ---
    downloadBtn.addEventListener('click', async () => {
        pause();
        processingOverlay.style.display = 'flex';

        const fps = parseInt(document.getElementById('export-fps').value) || 30;
        const format = document.getElementById('export-format').value || 'mp4';

        const stream = canvas.captureStream(fps);
        const audioContext = new AudioContext();
        const audioDestination = audioContext.createMediaStreamDestination();
        const sourceNode = audioContext.createMediaElementSource(sourceVideo);
        sourceNode.connect(audioDestination);
        
        const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...audioDestination.stream.getAudioTracks()
        ]);

        const recorder = new MediaRecorder(combinedStream, { mimeType: `video/${format === 'mp4' ? 'webm' : 'webm'}` }); // MediaRecorder a menudo graba en webm
        const chunks = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: `video/${format}` });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video_editado.${format}`;
            a.click();
            URL.revokeObjectURL(url);
            processingOverlay.style.display = 'none';
        };

        // Simular la reproducción para grabar
        sourceVideo.currentTime = 0;
        drawFrame(); // Dibuja el primer frame

        // Esperar a que el video esté listo para reproducir
        sourceVideo.addEventListener('canplay', async () => {
            await sourceVideo.play();
            recorder.start();
            sourceVideo.addEventListener('ended', () => {
                recorder.stop();
                sourceVideo.pause();
            }, { once: true });
        }, { once: true });
    });

    async function searchMusic() {
        const query = musicSearchInput.value;
        if (!query) return;

        musicResultsContainer.innerHTML = '<p>Buscando...</p>';

        try {
            const response = await fetch(`${BACKEND_URL}/api/youtube/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error en la búsqueda');
            renderMusicResults(data.items);
        } catch (error) {
            console.error('Error al buscar en YouTube:', error);
            musicResultsContainer.innerHTML = `<p>${error.message}</p>`;
        }
    }

    function renderMusicResults(items) {
        musicResultsContainer.innerHTML = '';
        items.forEach(item => {
            const resultEl = document.createElement('div');
            resultEl.className = 'music-result-item';
            resultEl.innerHTML = `
                <img src="${item.snippet.thumbnails.default.url}" alt="thumbnail">
                <span>${item.snippet.title}</span>
            `;
            resultEl.addEventListener('click', () => addAudioToTimeline(item));
            musicResultsContainer.appendChild(resultEl);
        });
    }

    function addVideoToTimeline(file) {
        const videoEl = document.createElement('video');
        videoEl.src = URL.createObjectURL(file);
        videoEl.addEventListener('loadedmetadata', () => {
            const newClip = {
                id: `video-${Date.now()}`,
                type: 'video',
                file: file,
                title: file.name,
                start: 0,
                duration: videoEl.duration,
                element: null
            };
            videoClips.push(newClip);
            renderTimeline();
        });
    }

    function addAudioToTimeline(item) {
        const audioId = item.id.videoId;
        const audioTitle = item.snippet.title;

        // Evitar añadir duplicados
        if (audioClips.some(clip => clip.id === audioId)) {
            alert('Esta canción ya está en la línea de tiempo.');
            return;
        }

        // Añadir a la lista de clips de audio
        const newClip = {
            id: audioId,
            title: audioTitle,
            start: 0, // Por ahora, todos empiezan al inicio
            duration: 180 // Simulado: 3 minutos
        };
        audioClips.push(newClip);

        renderTimeline();
    }

    function renderTimeline() {
        // Limpiar pistas
        videoTrack.querySelectorAll('.timeline-clip').forEach(el => el.remove());
        audioTrack.querySelectorAll('.timeline-clip').forEach(el => el.remove());

        videoClips.forEach(clip => {
            const clipEl = createClipElement(clip);
            videoTrack.appendChild(clipEl);
            clip.element = clipEl;
        });

        audioClips.forEach(clip => {
            const clipEl = createClipElement(clip);
            audioTrack.appendChild(clipEl);
            clip.element = clipEl;
        });
    }

    function createClipElement(clip) {
        const clipEl = document.createElement('div');
        clipEl.className = 'timeline-clip';
        clipEl.textContent = clip.title || clip.file.name;
        clipEl.style.left = `${clip.start * PIXELS_PER_SECOND}px`;
        clipEl.style.width = `${clip.duration * PIXELS_PER_SECOND}px`;
        clipEl.dataset.id = clip.id;

        // Evento para seleccionar el clip
        clipEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectClip(clip);
        });
        return clipEl;
    }

    function selectClip(clip) {
        // Deseleccionar el anterior
        if (selectedClip && selectedClip.element) {
            selectedClip.element.classList.remove('selected');
        }
        // Seleccionar el nuevo
        selectedClip = clip;
        if (selectedClip && selectedClip.element) {
            selectedClip.element.classList.add('selected');
        }
        // Habilitar botones de herramientas
        toolCutBtn.disabled = false;
        toolDeleteBtn.disabled = false;
        toolMuteBtn.disabled = selectedClip.type !== 'audio'; // Solo para audio
        if (selectedClip.isMuted) toolMuteBtn.classList.add('active'); else toolMuteBtn.classList.remove('active');
    }

    // --- Lógica de Herramientas ---
    toolDeleteBtn.addEventListener('click', () => {
        if (!selectedClip) {
            alert('Selecciona un clip para eliminar.');
            return;
        }
        if (selectedClip.type === 'video') {
            videoClips = videoClips.filter(c => c.id !== selectedClip.id);
        } else {
            audioClips = audioClips.filter(c => c.id !== selectedClip.id);
        }
        selectedClip = null;
        renderTimeline();
    });

    toolCutBtn.addEventListener('click', () => {
        if (!selectedClip) {
            alert('Selecciona un clip para cortar.');
            return;
        }
        const cutTime = sourceVideo.currentTime;
        if (cutTime <= selectedClip.start || cutTime >= selectedClip.start + selectedClip.duration) {
            alert('El cabezal de reproducción debe estar dentro del clip seleccionado.');
            return;
        }

        const originalDuration = selectedClip.duration;
        const splitPoint = cutTime - selectedClip.start;

        // Acortar el clip original
        selectedClip.duration = splitPoint;

        // Crear el nuevo clip
        const newClip = { ...selectedClip, id: `${selectedClip.type}-${Date.now()}` };
        newClip.start = cutTime;
        newClip.duration = originalDuration - splitPoint;

        if (selectedClip.type === 'video') videoClips.push(newClip);
        else audioClips.push(newClip);

        renderTimeline();
    });

    toolMuteBtn.addEventListener('click', () => {
        if (selectedClip && selectedClip.type === 'audio') {
            selectedClip.isMuted = !selectedClip.isMuted;
            selectedClip.element.style.opacity = selectedClip.isMuted ? '0.5' : '1';
            toolMuteBtn.classList.toggle('active', selectedClip.isMuted);
            alert(`El clip de audio ha sido ${selectedClip.isMuted ? 'silenciado' : 'activado'}.`);
        }
    });

    // --- Lógica de Drag & Drop en la Línea de Tiempo ---
    [videoTrack, audioTrack].forEach(track => {
        track.addEventListener('dragover', (e) => {
            e.preventDefault();
            track.classList.add('drag-over');
        });
        track.addEventListener('dragleave', () => {
            track.classList.remove('drag-over');
        });
        track.addEventListener('drop', (e) => {
            e.preventDefault();
            track.classList.remove('drag-over');
            const fileName = e.dataTransfer.getData('text/plain');
            const file = mediaFiles.find(f => f.name === fileName);
            if (!file) return;

            const isVideo = file.type.startsWith('video/');
            if (isVideo && track.id === 'video-track') {
                addVideoToTimeline(file);
            }
            // Aquí iría la lógica para añadir audio si se suelta en la pista de audio
        });
    });

    // --- Lógica para UI Móvil ---
    mobileTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            mobileTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetPanelClass = btn.dataset.panel;
            editorPanels.forEach(panel => {
                panel.classList.toggle('active-panel', panel.classList.contains(targetPanelClass));
            });
        });
    }

    musicSearchBtn.addEventListener('click', searchMusic);
    musicSearchInput.addEventListener('keydown', (e) => e.key === 'Enter' && searchMusic());
});
