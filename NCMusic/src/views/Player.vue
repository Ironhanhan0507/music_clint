<script setup>
import { ref, onMounted, computed, watch, nextTick } from "vue";
import api from "@/api";
import { useRoute } from "vue-router";

const route = useRoute();
// 得到当前歌曲id
const songId = computed(() => route.query.id);
// 歌曲信息
const songTitle = ref("正在播放的歌曲");
const songArtist = ref("未知艺术家");
const songAlbum = ref("未知专辑");
const songCover = ref("https://via.placeholder.com/260x260.png?text=Cover");

// 歌词存储为对象数组，每个对象包含时间和文本
const lyrics = ref([]);

// 音乐播放地址
const audioUrl = ref("");
const currentTime = ref(0);
const duration = ref(0);
const isPlaying = ref(false);

// 获取audio标签
const audioRef = ref(null);

// 当前高亮的歌词索引
const highlightIndex = computed(() => {
	if (!lyrics.value.length) return -1;
	const time = currentTime.value;
	let index = -1;
	for (let i = 0; i < lyrics.value.length; i++) {
		if (lyrics.value[i].time <= time) {
			index = i;
		} else {
			break; // 因为歌词是按时间排序的，一旦超过就可以退出
		}
	}
	return index;
});

// 监听高亮索引变化，自动滚动到对应歌词
watch(highlightIndex, newIndex => {
	if (newIndex >= 0) {
		nextTick(() => {
			const lyricsLines = document.querySelectorAll(".lyrics-line");
			if (lyricsLines[newIndex]) {
				lyricsLines[newIndex].scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
			}
		});
	}
});

// 监听歌曲ID变化，重新加载数据
watch(songId, () => {
	// 重置播放状态
	if (audioRef.value) {
		audioRef.value.pause();
		isPlaying.value = false;
		currentTime.value = 0;
		duration.value = 0;
	}
	loadSongData();
});

// 加载歌曲元数据
const handleLoadedMetadata = () => {
	const audio = audioRef.value;
	if (!audio) return;
	duration.value = audio.duration || 0;
	currentTime.value = audio.currentTime || 0;
};

// 格式化时间
const fmtTime = seconds => {
	if (!seconds || !Number.isFinite(seconds)) return "00:00";
	const s = Math.floor(seconds);
	const m = Math.floor(seconds / 60);
	const rs = s % 60;
	const mm = m.toString().padStart(2, "0");
	const ss = rs.toString().padStart(2, "0");
	return `${mm}:${ss}`;
};

// 获取歌曲详情
const fetchSongDetail = async () => {
	try {
		const id = songId.value;
		if (!id) return;
		const res = await api.get("/song/detail", { ids: id });
		console.log("歌曲详情数据:", res);
		const detail = res.songs?.[0];
		console.log(detail);
		if (detail) {
			songTitle.value = detail.name || "未知歌曲";
			songArtist.value = detail.ar.map(artist => artist.name).join(", ") || "未知艺术家";
			songAlbum.value = detail.al?.name || "未知专辑";
			songCover.value = detail.al?.picUrl || "https://via.placeholder.com/260x260.png?text=Cover+Unavailable";
		}
	} catch (error) {
		console.error("Failed to fetch song details获取歌曲详情失败:", error);
	}
};

// 获取歌词
const fetchLyrics = async () => {
	try {
		const id = songId.value;
		if (!id) return;
		const res = await api.get("/lyric", { id });
		console.log("歌词数据:", res);
		const raw = res.lrc?.lyric || "";
		// 解析获取到的歌词数据
		const parsedLyrics = parseLyric(raw);
		lyrics.value = parsedLyrics;
		console.log("解析后的歌词:", parsedLyrics);
	} catch (error) {
		console.error("Failed to fetch lyrics获取歌词失败:", error);
		lyrics.value = [];
	}
};

// 解析歌词（带时间戳）
const parseLyric = raw => {
	if (!raw) return [];

	const lines = raw.split("\n"); // 按行分割
	const lyricItems = [];

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;

		// 正则匹配时间标签，格式如 [00:12.34] 或 [01:23]
		const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
		let match;
		let firstTime = null;
		let text = trimmedLine;

		// 收集所有匹配到的时间标签
		const times = [];
		while ((match = timeRegex.exec(trimmedLine)) !== null) {
			const minutes = parseInt(match[1], 10);
			const seconds = parseInt(match[2], 10);
			let milliseconds = 0;
			if (match[3]) {
				// 处理毫秒，可能是2位或3位
				milliseconds = parseInt(match[3].padEnd(3, "0"), 10);
			}
			const totalSeconds = minutes * 60 + seconds + milliseconds / 1000;
			times.push(totalSeconds);
		}

		if (times.length > 0) {
			firstTime = times[0]; // 取第一个时间标签
			// 移除所有时间标签
			text = trimmedLine.replace(/\[[^\]]*\]/g, "").trim();
		}

		// 只有有时间标签且文本不为空的才加入
		if (firstTime !== null && text) {
			lyricItems.push({
				time: firstTime,
				text: text,
			});
		}
	}

	// 按时间排序
	lyricItems.sort((a, b) => a.time - b.time);

	return lyricItems;
};

// 获取播放地址
const fetchSongUrl = async () => {
	try {
		const id = songId.value;
		if (!id) return;
		const res = await api.get("/song/url", { id });
		const item = res.data?.[0];
		audioUrl.value = item?.url || "";
		currentTime.value = 0;
		duration.value = 0;
		isPlaying.value = false;
	} catch (error) {
		console.error("Failed to fetch song URL获取歌曲播放地址失败:", error);
	}
};

// 加载所有歌曲数据
const loadSongData = async () => {
	await Promise.all([fetchSongDetail(), fetchLyrics(), fetchSongUrl()]);
};

// 播放事件
const handleTogglePlay = () => {
	const audio = audioRef.value;
	if (!audio || !audioUrl.value) return;
	if (audio.paused) {
		audio
			.play()
			.then(() => {
				isPlaying.value = true;
			})
			.catch(error => {
				console.error("Failed to play audio播放失败:", error);
			});
	} else {
		audio.pause();
		isPlaying.value = false;
	}
};

// 播放结束暂停
const handleAudioEnded = () => {
	isPlaying.value = false;
};

// 播放时间更新
const handleTimeUpdate = () => {
	const audio = audioRef.value;
	if (!audio) return;
	currentTime.value = audio.currentTime || 0;
	if (audio.duration) {
		duration.value = audio.duration;
	}
};

// 点击进度条
const handleProgressClick = e => {
	const bar = e.currentTarget;
	const rect = bar.getBoundingClientRect();
	const ratio = (e.clientX - rect.left) / rect.width;
	const audio = audioRef.value;
	const newTime = ratio * duration.value;
	if (!audio) return;
	audio.currentTime = newTime;
	currentTime.value = newTime;
};

onMounted(() => {
	console.log("当前歌曲ID:", songId.value);
	loadSongData();
});
</script>

<template>
	<div class="player-page">
		<div class="player-inner">
			<div class="player-main">
				<!-- 左侧，封面与基本信息 -->
				<div class="player-left">
					<div class="cover-wrapr">
						<div class="cover-disc">
							<img class="cover-img" :src="songCover" alt="封面" />
						</div>
					</div>
					<div class="song-meta">
						<h2 class="song-title">{{ songTitle }}</h2>
						<p class="song-artist">{{ songArtist }}</p>
						<p class="song-album">{{ songAlbum }}</p>
					</div>
				</div>
				<!-- 右侧歌词信息 -->
				<div class="player-right">
					<div class="lyrics-card">
						<h3 class="lyrics-title">歌词</h3>
						<div class="lyrics-content">
							<template v-if="lyrics.length">
								<p v-for="(line, index) in lyrics" :key="index" class="lyrics-line" :class="{ 'lyrics-line--highlight': highlightIndex === index }">
									{{ line.text }}
								</p>
							</template>
							<p v-else class="lyrics-line">暂无歌词</p>
						</div>
					</div>
				</div>
			</div>
			<!-- 底部控制区 -->
			<div class="player-controls">
				<div class="controls-main">
					<button class="btn-circle btn-large" @click="handleTogglePlay">{{ isPlaying ? "⏸" : "▶" }}</button>
				</div>
				<div class="progress-wrap">
					<span class="time-label">{{ fmtTime(currentTime) }}</span>
					<div class="progress-bar" @click="handleProgressClick">
						<div class="progress-inner" :style="{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }"></div>
					</div>
					<span class="time-label">{{ fmtTime(duration) }}</span>
				</div>
				<audio :src="audioUrl" v-if="audioUrl" class="audio-hidden" ref="audioRef" @loadedmetadata="handleLoadedMetadata" @timeupdate="handleTimeUpdate" @ended="handleAudioEnded"></audio>
			</div>
		</div>
	</div>
</template>

<style scoped>
.player-page {
	min-height: calc(100vh - 90px);
	background: radial-gradient(circle at top left, #2b2b2b, #000);
	color: #f5f5f5;
	display: flex;
	justify-content: center;
	padding: 40px 0;
	box-sizing: border-box;
}

.player-inner {
	width: 100%;
	max-width: 1200px;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 32px;
}

.player-main {
	width: 100%;
	display: flex;
	gap: 32px;
}

.player-left {
	width: 320px;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.cover-wrap {
	width: 260px;
	height: 260px;
	border-radius: 50%;
	background: radial-gradient(circle, #444, #111);
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
}

.cover-disc {
	width: 220px;
	height: 220px;
	border-radius: 50%;
	overflow: hidden;
}

.cover-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.song-meta {
	margin-top: 20px;
	text-align: center;
}

.song-title {
	margin: 0;
	font-size: 22px;
	font-weight: 600;
}

.song-artist,
.song-album {
	margin: 6px 0 0;
	font-size: 13px;
	color: #cfcfcf;
}

.player-right {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
}

.lyrics-card {
	width: 100%;
	max-height: 520px;
	padding: 18px 24px;
	border-radius: 16px;
	background: transparent;
	box-shadow: none;
	box-sizing: border-box;
}

.lyrics-title {
	margin: 0 0 16px;
	font-size: 18px;
	color: #fff;
	text-align: center;
	letter-spacing: 1px;
}

.lyrics-content {
	max-height: 460px;
	overflow-y: auto;
	overflow-x: hidden;
	padding-right: 0;
}

.lyrics-line {
	margin: 6px 0;
	font-size: 16px;
	line-height: 1.6;
	color: rgba(255, 255, 255, 0.65);
	text-align: center;
	transition: all 0.2s ease;
	white-space: normal;
	cursor: default;
}

.lyrics-line--highlight {
	color: #ffffff;
	font-size: 18px;
	font-weight: 600;
	transform: scale(1.02);
}

.lyrics-content::-webkit-scrollbar {
	width: 0;
	height: 0;
}

.lyrics-content {
	scrollbar-width: none;
	scrollbar-color: transparent transparent;
}

.player-controls {
	width: 100%;
	padding: 16px 24px 0;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.audio-hidden {
	display: none;
}

.controls-main {
	display: flex;
	align-items: center;
	gap: 24px;
}

.btn-circle {
	border-radius: 50%;
	border: none;
	cursor: pointer;
	background: #fff;
	color: #000;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

.btn-large {
	width: 56px;
	height: 56px;
	font-size: 22px;
}

.btn-small {
	width: 40px;
	height: 40px;
	font-size: 18px;
}

.btn-circle:hover {
	transform: translateY(-1px);
}

.progress-wrap {
	display: flex;
	align-items: center;
	gap: 12px;
}

.time-label {
	font-size: 12px;
	color: #c0c0c0;
}

.progress-bar {
	flex: 1;
	height: 4px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.2);
	overflow: hidden;
}

.progress-inner {
	height: 100%;
	border-radius: 999px;
	background: linear-gradient(90deg, #ff4b2b, #ff416c);
}

.controls-extra {
	display: none;
}

.extra-left,
.extra-right {
	display: none;
}

.btn-text {
	display: none;
}

.btn-text:hover {
	color: #fff;
}

@media (max-width: 960px) {
	.player-inner {
		flex-direction: column;
	}

	.player-main {
		flex-direction: column;
		align-items: center;
	}

	.player-left {
		width: auto;
	}
}
</style>
