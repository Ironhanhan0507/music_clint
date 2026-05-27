// Player.vue
<template>
	<div class="player-page">
		<div class="player-inner">
			<div class="player-main">
				<!-- 左侧封面与基本信息 -->
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
						<p class="playlist-index" v-if="playlistTracks.length">{{ currentTrackIndex + 1 }} / {{ playlistTracks.length }}</p>
					</div>
				</div>
				<!-- 右侧歌词 -->
				<div class="player-right">
					<div class="lyrics-card">
						<div class="lyrics-header">
							<h3 class="lyrics-title">歌词</h3>
							<button class="comment-btn" @click="openCommentModal">💬 评论</button>
						</div>
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
					<button class="btn-circle btn-small" @click="toggleLoop" :title="isLoop ? '关闭单曲循环' : '开启单曲循环'">
						{{ isLoop ? "🔂" : "🔁" }}
					</button>
					<button class="btn-circle btn-small" @click="prevTrack" :disabled="!canSwitchPrev" title="上一首">⏮</button>
					<button class="btn-circle btn-large" @click="handleTogglePlay">
						{{ isPlaying ? "⏸" : "▶" }}
					</button>
					<button class="btn-circle btn-small" @click="nextTrack" :disabled="!canSwitchNext" title="下一首">⏭</button>
				</div>
				<div class="progress-wrap">
					<span class="time-label">{{ fmtTime(currentTime) }}</span>
					<div class="progress-bar" @click="handleProgressClick">
						<div class="progress-inner" :style="{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }"></div>
					</div>
					<span class="time-label">{{ fmtTime(duration) }}</span>
				</div>
				<audio :src="audioUrl" v-if="audioUrl" class="audio-hidden" ref="audioRef"></audio>
			</div>
		</div>

		<!-- 评论弹窗 Modal -->
		<Teleport to="body">
			<div v-if="isCommentModalVisible" class="comment-modal-overlay" @click="closeCommentModal">
				<div class="comment-modal-container" @click="stopPropagation">
					<div class="comment-modal-header">
						<h3>歌曲评论</h3>
						<button class="close-modal-btn" @click="closeCommentModal">✕</button>
					</div>
					<div class="comment-modal-body">
						<div class="comment-song-info">
							<img class="comment-song-cover" :src="songCover" alt="封面" />
							<div class="comment-song-detail">
								<p class="comment-song-title">{{ songTitle }}</p>
								<p class="comment-song-artist">{{ songArtist }}</p>
							</div>
						</div>
						<div class="comment-stat">
							<span>共 {{ commentTotal }} 条评论</span>
							<div class="sort-buttons">
								<button class="sort-btn" :class="{ active: sortType === 'hot' }" @click="changeSortType('hot')">🔥 热度</button>
								<button class="sort-btn" :class="{ active: sortType === 'time' }" @click="changeSortType('time')">🕒 时间</button>
							</div>
						</div>
						<div class="comment-list" v-if="!commentLoading">
							<div v-if="comments.length" class="comment-items">
								<div v-for="(comment, idx) in comments" :key="idx" class="comment-item">
									<div class="comment-avatar">
										<img v-if="comment.user.avatarUrl" :src="comment.user.avatarUrl" alt="头像" />
										<div v-else class="default-avatar">🎵</div>
									</div>
									<div class="comment-content">
										<div class="comment-user-info">
											<span class="comment-nickname">{{ comment.user.nickname }}</span>
											<span class="comment-time">{{ fmtCommentTime(comment.time) }}</span>
										</div>
										<p class="comment-text">{{ comment.content }}</p>
										<div class="comment-like">
											<span class="like-icon">❤️</span>
											<span>{{ comment.likedCount || 0 }}</span>
										</div>
									</div>
								</div>
							</div>
							<div v-else class="empty-comment">暂无评论，快来抢沙发吧~</div>
							<div v-if="commentHasMore && !commentLoadingMore" class="load-more-btn" @click="loadMoreComments">加载更多评论</div>
							<div v-if="commentLoadingMore" class="comment-loading" style="padding: 20px">
								<div class="loading-spinner"></div>
								<span>加载中...</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick, onBeforeUnmount } from "vue";
import api from "@/api";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

// 歌曲id 和 歌单id
const songId = computed(() => route.query.id);
const playlistId = computed(() => route.query.playlistId);

// 歌曲信息
const songTitle = ref("正在播放的歌曲");
const songArtist = ref("未知艺术家");
const songAlbum = ref("未知专辑");
const songCover = ref("https://via.placeholder.com/260x260.png?text=Cover");

// 歌词
const lyrics = ref([]);

// 播放相关
const audioUrl = ref("");
const currentTime = ref(0);
const duration = ref(0);
const isPlaying = ref(false);
const audioRef = ref(null);

// 单曲循环
const isLoop = ref(false);

// 歌单相关
const playlistTracks = ref([]); // 歌单歌曲列表 [{ id, name, artist, album, duration }]
const currentTrackIndex = ref(-1); // 当前歌曲在歌单中的索引

// 自动播放标志（切歌后保持播放状态）
const autoPlayNext = ref(false);

// 评论相关
const isCommentModalVisible = ref(false);
const comments = ref([]);
const commentLoading = ref(false);
const commentTotal = ref(0);
const commentPage = ref(1);
const commentHasMore = ref(true);
const commentLoadingMore = ref(false);
const sortType = ref("hot"); // 'hot' 或 'time'

// 存储事件处理器，用于清理
let playHandler = null;
let pauseHandler = null;
let endedHandler = null;
let timeUpdateHandler = null;
let loadedMetadataHandler = null;
let canPlayHandler = null;

// 高亮歌词索引
const highlightIndex = computed(() => {
	if (!lyrics.value.length) return -1;
	const time = currentTime.value;
	let index = -1;
	for (let i = 0; i < lyrics.value.length; i++) {
		if (lyrics.value[i].time <= time) index = i;
		else break;
	}
	return index;
});

// 是否可以切换上一首/下一首
const canSwitchPrev = computed(() => playlistTracks.value.length > 1 && currentTrackIndex.value > 0);
const canSwitchNext = computed(() => playlistTracks.value.length > 1 && currentTrackIndex.value < playlistTracks.value.length - 1);

// 歌词自动滚动
watch(highlightIndex, newIndex => {
	if (newIndex >= 0) {
		nextTick(() => {
			const lines = document.querySelectorAll(".lyrics-line");
			if (lines[newIndex]) {
				lines[newIndex].scrollIntoView({ behavior: "smooth", block: "center" });
			}
		});
	}
});

// 监听歌单ID变化，重新获取歌单详情
watch(playlistId, async () => {
	await fetchPlaylistDetail();
	// 歌单更新后，同步当前歌曲索引
	updateCurrentTrackIndex();
});

// 监听歌曲ID变化，加载歌曲资源
watch(songId, async (newId, oldId) => {
	if (!newId) return;
	// 重置音频URL，避免旧音频残留
	audioUrl.value = "";
	// 重新加载歌曲详情、歌词、播放地址
	await Promise.all([fetchSongDetail(), fetchLyrics(), fetchSongUrl()]);
	// 更新当前歌曲索引
	updateCurrentTrackIndex();
	// 如果有自动播放标志，尝试播放
	if (autoPlayNext.value) {
		nextTick(() => {
			const audio = audioRef.value;
			if (audio && audioUrl.value) {
				audio.play().catch(err => console.warn("自动播放失败:", err));
			}
			autoPlayNext.value = false;
		});
	}
});

// 监听audioUrl变化，重新绑定事件（因为v-if会重建audio元素）
watch(audioUrl, () => {
	nextTick(() => {
		bindAudioEvents();
	});
});

// 监听循环模式变化，同步到audio元素
watch(isLoop, newVal => {
	if (audioRef.value) {
		audioRef.value.loop = newVal;
	}
});

// 控制body滚动（弹窗时禁止滚动）
watch(isCommentModalVisible, newVal => {
	document.body.style.overflow = newVal ? "hidden" : "";
});

// ---------- 歌单相关 ----------
const fetchPlaylistDetail = async () => {
	const id = playlistId.value;
	if (!id) return;
	try {
		const res = await api.get("/playlist/detail", { id });
		const detail = res.playlist;
		if (detail && detail.tracks) {
			playlistTracks.value = detail.tracks.map(item => ({
				id: item.id,
				name: item.name,
				artist: item.ar.map(artist => artist.name).join(", "),
				album: item.al?.name || "未知专辑",
				duration: item.dt || 0,
			}));
		} else {
			playlistTracks.value = [];
		}
	} catch (error) {
		console.error("获取歌单详情失败:", error);
		playlistTracks.value = [];
	}
};

// 根据当前songId更新索引
const updateCurrentTrackIndex = () => {
	const id = songId.value;
	if (!id || !playlistTracks.value.length) {
		currentTrackIndex.value = -1;
		return;
	}
	const index = playlistTracks.value.findIndex(track => track.id == id);
	currentTrackIndex.value = index !== -1 ? index : -1;
};

// 切歌逻辑（delta: 1下一首，-1上一首）
const switchTrack = delta => {
	if (!playlistTracks.value.length) return;
	let newIndex = currentTrackIndex.value + delta;
	// 列表循环：边界处理
	if (newIndex < 0) newIndex = playlistTracks.value.length - 1;
	if (newIndex >= playlistTracks.value.length) newIndex = 0;
	if (newIndex === currentTrackIndex.value) return; // 无效切换

	const newSongId = playlistTracks.value[newIndex].id;
	if (!newSongId) return;

	// 记录切换前的播放状态，用于新歌自动播放
	const audio = audioRef.value;
	autoPlayNext.value = audio ? !audio.paused : true; // 如果当前正在播放则自动播放下首

	// 更新路由，触发watch(songId)重新加载
	router.replace({
		name: "player",
		query: {
			id: newSongId,
			playlistId: playlistId.value,
		},
	});
};

const nextTrack = () => switchTrack(1);
const prevTrack = () => switchTrack(-1);

// ---------- 歌曲资源 ----------
const fetchSongDetail = async () => {
	try {
		const id = songId.value;
		if (!id) return;
		const res = await api.get("/song/detail", { ids: id });
		const detail = res.songs?.[0];
		if (detail) {
			songTitle.value = detail.name || "未知歌曲";
			songArtist.value = detail.ar.map(artist => artist.name).join(", ") || "未知艺术家";
			songAlbum.value = detail.al?.name || "未知专辑";
			songCover.value = detail.al?.picUrl || "https://via.placeholder.com/260x260.png?text=Cover+Unavailable";
		}
	} catch (error) {
		console.error("获取歌曲详情失败:", error);
	}
};

const fetchLyrics = async () => {
	try {
		const id = songId.value;
		if (!id) return;
		const res = await api.get("/lyric", { id });
		const raw = res.lrc?.lyric || "";
		lyrics.value = parseLyric(raw);
	} catch (error) {
		console.error("获取歌词失败:", error);
		lyrics.value = [];
	}
};

const parseLyric = raw => {
	if (!raw) return [];
	const lines = raw.split("\n");
	const lyricItems = [];
	const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;
		let match;
		let firstTime = null;
		let text = trimmedLine;
		const times = [];
		while ((match = timeRegex.exec(trimmedLine)) !== null) {
			const minutes = parseInt(match[1], 10);
			const seconds = parseInt(match[2], 10);
			let milliseconds = 0;
			if (match[3]) milliseconds = parseInt(match[3].padEnd(3, "0"), 10);
			times.push(minutes * 60 + seconds + milliseconds / 1000);
		}
		if (times.length > 0) {
			firstTime = times[0];
			text = trimmedLine.replace(/\[[^\]]*\]/g, "").trim();
		}
		if (firstTime !== null && text) {
			lyricItems.push({ time: firstTime, text });
		}
	}
	lyricItems.sort((a, b) => a.time - b.time);
	return lyricItems;
};

const fetchSongUrl = async () => {
	try {
		const id = songId.value;
		if (!id) return;
		const res = await api.get("/song/url", { id });
		const item = res.data?.[0];
		audioUrl.value = item?.url || "";
		currentTime.value = 0;
		duration.value = 0;
	} catch (error) {
		console.error("获取播放地址失败:", error);
	}
};

// ---------- 播放控制 ----------
const handleTogglePlay = () => {
	const audio = audioRef.value;
	if (!audio || !audioUrl.value) return;
	if (audio.paused) {
		audio.play().catch(err => console.error("播放失败:", err));
	} else {
		audio.pause();
	}
};

const handleProgressClick = e => {
	const bar = e.currentTarget;
	const rect = bar.getBoundingClientRect();
	const ratio = (e.clientX - rect.left) / rect.width;
	const audio = audioRef.value;
	if (!audio) return;
	audio.currentTime = ratio * duration.value;
};

const toggleLoop = () => {
	isLoop.value = !isLoop.value;
};

// 音频事件绑定（确保播放状态同步 + 自动下一首）
const bindAudioEvents = () => {
	const audio = audioRef.value;
	if (!audio) return;

	// 移除旧监听
	if (playHandler) audio.removeEventListener("play", playHandler);
	if (pauseHandler) audio.removeEventListener("pause", pauseHandler);
	if (endedHandler) audio.removeEventListener("ended", endedHandler);
	if (timeUpdateHandler) audio.removeEventListener("timeupdate", timeUpdateHandler);
	if (loadedMetadataHandler) audio.removeEventListener("loadedmetadata", loadedMetadataHandler);
	if (canPlayHandler) audio.removeEventListener("canplay", canPlayHandler);

	// 定义新处理函数
	playHandler = () => {
		isPlaying.value = true;
	};
	pauseHandler = () => {
		isPlaying.value = false;
	};
	endedHandler = () => {
		// 非单曲循环模式：自动下一首
		if (!isLoop.value) {
			// 自动切歌时也要自动播放下一首
			autoPlayNext.value = true;
			nextTrack();
		}
	};
	timeUpdateHandler = () => {
		if (!audio) return;
		currentTime.value = audio.currentTime || 0;
		if (audio.duration) duration.value = audio.duration;
	};
	loadedMetadataHandler = () => {
		if (!audio) return;
		duration.value = audio.duration || 0;
		currentTime.value = audio.currentTime || 0;
	};
	canPlayHandler = () => {
		// 音频准备好后，如果存在自动播放标志，则播放
		if (autoPlayNext.value) {
			audio.play().catch(err => console.warn("自动播放失败:", err));
			autoPlayNext.value = false;
		}
	};

	// 添加新监听
	audio.addEventListener("play", playHandler);
	audio.addEventListener("pause", pauseHandler);
	audio.addEventListener("ended", endedHandler);
	audio.addEventListener("timeupdate", timeUpdateHandler);
	audio.addEventListener("loadedmetadata", loadedMetadataHandler);
	audio.addEventListener("canplay", canPlayHandler);

	// 同步loop属性
	audio.loop = isLoop.value;
};

// ---------- 评论相关 ----------
const fetchComments = async (reset = true) => {
	const id = songId.value;
	if (!id) return;
	if (reset) {
		commentPage.value = 1;
		comments.value = [];
		commentHasMore.value = true;
		commentLoading.value = true;
	} else {
		if (!commentHasMore.value || commentLoadingMore.value) return;
		commentLoadingMore.value = true;
	}
	try {
		const limit = 30;
		const offset = (commentPage.value - 1) * limit;
		const res = await api.get("/comment/music", { id, limit, offset });
		if (res.code === 200) {
			const newComments = res.comments || [];
			if (reset) {
				comments.value = newComments;
			} else {
				comments.value = [...comments.value, ...newComments];
			}
			commentTotal.value = res.total || 0;
			commentHasMore.value = comments.value.length < commentTotal.value;
			applySort();
		} else {
			if (reset) comments.value = [];
			commentHasMore.value = false;
		}
	} catch (error) {
		console.error("获取评论失败:", error);
		if (reset) comments.value = [];
		commentHasMore.value = false;
	} finally {
		if (reset) {
			commentLoading.value = false;
		} else {
			commentLoadingMore.value = false;
		}
	}
};

const loadMoreComments = () => {
	if (!commentHasMore.value || commentLoadingMore.value || commentLoading.value) return;
	commentPage.value++;
	fetchComments(false);
};

const openCommentModal = () => {
	if (!songId.value) return;
	isCommentModalVisible.value = true;
	fetchComments(true);
};

const closeCommentModal = () => {
	isCommentModalVisible.value = false;
};

const stopPropagation = e => e.stopPropagation();

const applySort = () => {
	if (!comments.value.length) return;
	if (sortType.value === "hot") {
		comments.value.sort((a, b) => (b.likedCount || 0) - (a.likedCount || 0));
	} else if (sortType.value === "time") {
		comments.value.sort((a, b) => (b.time || 0) - (a.time || 0));
	}
};

const changeSortType = type => {
	if (sortType.value === type) return;
	sortType.value = type;
	applySort();
};

// 工具函数
const fmtTime = seconds => {
	if (!seconds || !Number.isFinite(seconds)) return "00:00";
	const s = Math.floor(seconds);
	const m = Math.floor(seconds / 60);
	const rs = s % 60;
	return `${m.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}`;
};

const fmtCommentTime = timestamp => {
	if (!timestamp) return "未知时间";
	const date = new Date(timestamp);
	return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
};

// 生命周期
onMounted(async () => {
	await fetchPlaylistDetail();
	updateCurrentTrackIndex();
	await Promise.all([fetchSongDetail(), fetchLyrics(), fetchSongUrl()]);
	nextTick(() => {
		bindAudioEvents();
	});
});

onBeforeUnmount(() => {
	document.body.style.overflow = "";
	const audio = audioRef.value;
	if (audio) {
		if (playHandler) audio.removeEventListener("play", playHandler);
		if (pauseHandler) audio.removeEventListener("pause", pauseHandler);
		if (endedHandler) audio.removeEventListener("ended", endedHandler);
		if (timeUpdateHandler) audio.removeEventListener("timeupdate", timeUpdateHandler);
		if (loadedMetadataHandler) audio.removeEventListener("loadedmetadata", loadedMetadataHandler);
		if (canPlayHandler) audio.removeEventListener("canplay", canPlayHandler);
	}
});
</script>

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

.cover-wrapr {
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

.playlist-index {
	margin-top: 12px;
	font-size: 12px;
	color: #aaa;
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

.lyrics-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16px;
}

.lyrics-title {
	margin: 0;
	font-size: 18px;
	color: #fff;
	text-align: center;
	letter-spacing: 1px;
}

.comment-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #f5f5f5;
	font-size: 14px;
	padding: 6px 14px;
	border-radius: 30px;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 6px;
	transition: all 0.2s ease;
	font-weight: 500;
}

.comment-btn:hover {
	background: rgba(255, 255, 255, 0.2);
	border-color: rgba(255, 255, 255, 0.4);
	transform: translateY(-1px);
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
	justify-content: center;
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
	transition: all 0.2s ease;
}

.btn-circle:disabled {
	opacity: 0.4;
	cursor: not-allowed;
	transform: none;
}

.btn-circle:hover:not(:disabled) {
	transform: translateY(-2px);
	background: #f0f0f0;
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
	cursor: pointer;
}

.progress-inner {
	height: 100%;
	border-radius: 999px;
	background: linear-gradient(90deg, #ff4b2b, #ff416c);
}

/* 评论弹窗样式 */
.comment-modal-overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.75);
	backdrop-filter: blur(8px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 2000;
	padding: 20px;
	box-sizing: border-box;
}

.comment-modal-container {
	background: #1e1e2f;
	border-radius: 28px;
	width: 100%;
	max-width: 560px;
	max-height: 85vh;
	display: flex;
	flex-direction: column;
	box-shadow: 0 25px 40px rgba(0, 0, 0, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.1);
	overflow: hidden;
	animation: fadeSlideUp 0.2s ease-out;
}

@keyframes fadeSlideUp {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.comment-modal-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 18px 24px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.comment-modal-header h3 {
	margin: 0;
	font-size: 20px;
	font-weight: 600;
	color: #fff;
}

.close-modal-btn {
	background: transparent;
	border: none;
	color: #aaa;
	font-size: 24px;
	cursor: pointer;
	transition: color 0.2s;
	line-height: 1;
	padding: 0;
	width: 32px;
	height: 32px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
}

.close-modal-btn:hover {
	color: #fff;
	background: rgba(255, 255, 255, 0.1);
}

.comment-modal-body {
	flex: 1;
	overflow-y: auto;
	padding: 20px 24px;
	scrollbar-width: thin;
	scrollbar-color: #555 #2c2c3a;
}

.comment-modal-body::-webkit-scrollbar {
	width: 5px;
}

.comment-modal-body::-webkit-scrollbar-track {
	background: #2c2c3a;
	border-radius: 10px;
}

.comment-modal-body::-webkit-scrollbar-thumb {
	background: #555;
	border-radius: 10px;
}

.comment-song-info {
	display: flex;
	align-items: center;
	gap: 14px;
	margin-bottom: 20px;
	padding-bottom: 16px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.comment-song-cover {
	width: 48px;
	height: 48px;
	border-radius: 12px;
	object-fit: cover;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.comment-song-detail {
	flex: 1;
}

.comment-song-title {
	font-size: 16px;
	font-weight: 600;
	margin: 0 0 4px;
	color: #fff;
}

.comment-song-artist {
	font-size: 12px;
	margin: 0;
	color: #bbb;
}

.comment-stat {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 18px;
	font-size: 13px;
	color: #bbb;
}

.sort-buttons {
	display: flex;
	gap: 12px;
}

.sort-btn {
	background: transparent;
	border: none;
	color: #aaa;
	font-size: 13px;
	cursor: pointer;
	padding: 4px 8px;
	border-radius: 20px;
	transition: all 0.2s;
}

.sort-btn:hover {
	color: #fff;
	background: rgba(255, 255, 255, 0.1);
}

.sort-btn.active {
	color: #ff7e5e;
	background: rgba(255, 126, 94, 0.15);
}

.comment-list {
	min-height: 200px;
}

.comment-items {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.comment-item {
	display: flex;
	gap: 14px;
}

.comment-avatar {
	flex-shrink: 0;
	width: 36px;
	height: 36px;
	border-radius: 50%;
	background: #2c2c3a;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.comment-avatar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.default-avatar {
	font-size: 18px;
	color: #ff7e5e;
}

.comment-content {
	flex: 1;
}

.comment-user-info {
	display: flex;
	align-items: baseline;
	flex-wrap: wrap;
	gap: 8px;
	margin-bottom: 6px;
}

.comment-nickname {
	font-size: 14px;
	font-weight: 600;
	color: #ffa07a;
}

.comment-time {
	font-size: 11px;
	color: #888;
}

.comment-text {
	margin: 6px 0 8px;
	font-size: 14px;
	line-height: 1.5;
	color: #e0e0e0;
	word-break: break-word;
}

.comment-like {
	display: flex;
	align-items: center;
	gap: 5px;
	font-size: 12px;
	color: #ccc;
}

.like-icon {
	cursor: default;
	font-size: 14px;
}

.empty-comment {
	text-align: center;
	padding: 40px 20px;
	color: #aaa;
	font-size: 14px;
}

.comment-loading {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 50px;
	gap: 12px;
	color: #ccc;
}

.loading-spinner {
	width: 32px;
	height: 32px;
	border: 3px solid rgba(255, 255, 255, 0.2);
	border-top: 3px solid #ff6b4a;
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}

@keyframes spin {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

.load-more-btn {
	text-align: center;
	margin-top: 20px;
	padding: 10px;
	background: rgba(255, 255, 255, 0.05);
	border-radius: 30px;
	cursor: pointer;
	font-size: 14px;
	color: #ccc;
	transition: all 0.2s;
}

.load-more-btn:hover {
	background: rgba(255, 255, 255, 0.1);
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

	.comment-modal-container {
		max-width: 90%;
	}
}
</style>
