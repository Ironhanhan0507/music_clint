<template>
	<div class="player-page">
		<div class="player-inner">
			<!-- 左右布局容器 -->
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
						<div class="lyrics-content" ref="lyricsContentRef">
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
		</div>

		<!-- 底部控制区 -->
		<div class="player-controls">
			<div class="controls-main">
				<button class="btn-circle btn-small" @click="togglePlayMode" :title="playModeTitle">
					{{ playModeIcon }}
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
					<div
						class="progress-inner"
						:style="{
							width: duration ? `${(currentTime / duration) * 100}%` : '0%',
						}"
					></div>
				</div>
				<span class="time-label">{{ fmtTime(duration) }}</span>
			</div>
			<audio :src="audioUrl" v-if="audioUrl" class="audio-hidden" ref="audioRef"></audio>
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
							<img :src="songCover" class="comment-song-cover" alt="封面" />
							<div class="comment-song-detail">
								<div class="comment-song-title">{{ songTitle }}</div>
								<div class="comment-song-artist">{{ songArtist }}</div>
							</div>
						</div>
						<div class="comment-stat">
							<span>共 {{ commentTotal }} 条评论</span>
							<div class="sort-buttons">
								<button class="sort-btn" :class="{ active: sortType === 'hot' }" @click="changeSortType('hot')">最热</button>
								<button class="sort-btn" :class="{ active: sortType === 'time' }" @click="changeSortType('time')">最新</button>
							</div>
						</div>
						<div class="comment-list">
							<div v-if="commentLoading" class="comment-loading">
								<div class="loading-spinner"></div>
								<span>加载评论中...</span>
							</div>
							<div v-else-if="comments.length === 0" class="empty-comment">暂无评论，快来抢沙发吧~</div>
							<div v-else class="comment-items">
								<div v-for="item in comments" :key="item.commentId" class="comment-item">
									<div class="comment-avatar">
										<img v-if="item.user.avatarUrl" :src="item.user.avatarUrl" alt="头像" />
										<span v-else class="default-avatar">🎵</span>
									</div>
									<div class="comment-content">
										<div class="comment-user-info">
											<span class="comment-nickname">{{ item.user.nickname }}</span>
											<span class="comment-time">{{ fmtCommentTime(item.time) }}</span>
										</div>
										<div class="comment-text">{{ item.content }}</div>
										<div class="comment-like">
											<span class="like-icon">👍</span>
											<span>{{ item.likedCount || 0 }}</span>
										</div>
									</div>
								</div>
								<div v-if="commentHasMore && !commentLoadingMore" class="load-more-btn" @click="loadMoreComments">加载更多评论</div>
								<div v-if="commentLoadingMore" class="comment-loading" style="padding: 20px">
									<div class="loading-spinner"></div>
								</div>
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

// 路由参数
const songId = computed(() => route.query.id);
const playlistId = computed(() => route.query.playlistId);
const singerId = computed(() => route.query.singerId);
const source = computed(() => route.query.source); // 'playlist' 或 'singer'

// 播放列表相关
const playlistTracks = ref([]); // [{ id, name, artist, album, duration }]
const currentTrackIndex = ref(-1); // 原始列表中的索引

// 播放模式: 'list'（列表循环）, 'random'（随机播放）, 'loop'（单曲循环）
const playMode = ref("list");
const playModeIcon = computed(() => {
	if (playMode.value === "list") return "🔁";
	if (playMode.value === "random") return "🔀";
	return "🔂";
});
const playModeTitle = computed(() => {
	if (playMode.value === "list") return "列表循环";
	if (playMode.value === "random") return "随机播放";
	return "单曲循环";
});

// 随机播放相关
const randomIndices = ref([]);
const randomIndex = ref(-1);

// 其他状态
const songTitle = ref("正在播放的歌曲");
const songArtist = ref("未知艺术家");
const songAlbum = ref("未知专辑");
const songCover = ref("https://via.placeholder.com/260x260.png?text=Cover");
const lyrics = ref([]);
const audioUrl = ref("");
const currentTime = ref(0);
const duration = ref(0);
const isPlaying = ref(false);
const audioRef = ref(null);
const autoPlayNext = ref(false);

// 评论相关
const isCommentModalVisible = ref(false);
const comments = ref([]);
const commentLoading = ref(false);
const commentTotal = ref(0);
const commentPage = ref(1);
const commentHasMore = ref(true);
const commentLoadingMore = ref(false);
const sortType = ref("hot");

// 事件处理器
let playHandler = null;
let pauseHandler = null;
let endedHandler = null;
let timeUpdateHandler = null;
let loadedMetadataHandler = null;
let canPlayHandler = null;

// 歌词滚动相关
const lyricsContentRef = ref(null);

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

// 滚动到当前高亮的歌词行
const scrollToHighlightLyric = () => {
	if (!lyricsContentRef.value) return;
	const container = lyricsContentRef.value;
	const highlightLine = container.querySelector(".lyrics-line--highlight");
	if (highlightLine) {
		highlightLine.scrollIntoView({ behavior: "smooth", block: "center" });
	}
};

// 监听高亮索引变化，自动滚动
watch(highlightIndex, () => {
	nextTick(() => scrollToHighlightLyric());
});

// 歌词列表首次加载完成后也滚动一次
watch(
	lyrics,
	() => {
		nextTick(() => scrollToHighlightLyric());
	},
	{ immediate: true },
);

// 是否可以切换上一首/下一首
const canSwitchPrev = computed(() => playlistTracks.value.length > 1);
const canSwitchNext = computed(() => playlistTracks.value.length > 1);

// ------------------- 播放列表获取 -------------------
const fetchPlaylistDetail = async () => {
	const id = playlistId.value;
	if (!id) return [];
	try {
		const res = await api.get("/playlist/detail", { id });
		const detail = res.playlist;
		if (detail && detail.tracks) {
			return detail.tracks.map(item => ({
				id: item.id,
				name: item.name,
				artist: item.ar.map(artist => artist.name).join(", "),
				album: item.al?.name || "未知专辑",
				duration: item.dt || 0,
			}));
		}
		return [];
	} catch (error) {
		console.error("获取歌单详情失败:", error);
		return [];
	}
};

const fetchSingerHotSongs = async () => {
	const id = singerId.value;
	if (!id) return [];
	try {
		const res = await api.get("/artists", { id });
		const data = res?.data || res;
		if (data.code !== 200) return [];
		const hotSongs = data.hotSongs || [];
		return hotSongs.map((song, idx) => ({
			id: song.id,
			name: song.name || "未知歌曲",
			artist: (song.ar || song.artists || []).map(a => a.name).join(", ") || "未知艺术家",
			album: song.al?.name || "未知专辑",
			duration: song.dt || song.duration || 0,
		}));
	} catch (error) {
		console.error("获取歌手热门歌曲失败:", error);
		return [];
	}
};

const loadPlaylist = async () => {
	let tracks = [];
	if (source.value === "singer" && singerId.value) {
		tracks = await fetchSingerHotSongs();
	} else if (playlistId.value) {
		tracks = await fetchPlaylistDetail();
	}
	playlistTracks.value = tracks;
	resetRandomMode();
};

const updateCurrentTrackIndex = () => {
	const id = songId.value;
	if (!id || !playlistTracks.value.length) {
		currentTrackIndex.value = -1;
		return;
	}
	const index = playlistTracks.value.findIndex(track => track.id == id);
	currentTrackIndex.value = index !== -1 ? index : -1;
	if (playMode.value === "random" && randomIndices.value.length) {
		const pos = randomIndices.value.findIndex(idx => idx === currentTrackIndex.value);
		randomIndex.value = pos !== -1 ? pos : 0;
	}
};

// ------------------- 随机播放辅助 -------------------
const generateRandomIndices = () => {
	const len = playlistTracks.value.length;
	if (len === 0) return [];
	const indices = Array.from({ length: len }, (_, i) => i);
	const currentIdx = currentTrackIndex.value;
	const others = indices.filter(i => i !== currentIdx);
	for (let i = others.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[others[i], others[j]] = [others[j], others[i]];
	}
	return [currentIdx, ...others];
};

const resetRandomMode = () => {
	if (playMode.value === "random" && playlistTracks.value.length > 1) {
		randomIndices.value = generateRandomIndices();
		randomIndex.value = 0;
	} else {
		randomIndices.value = [];
		randomIndex.value = -1;
	}
};

// 切换播放模式
const togglePlayMode = () => {
	if (playMode.value === "list") playMode.value = "random";
	else if (playMode.value === "random") playMode.value = "loop";
	else playMode.value = "list";

	if (audioRef.value) {
		audioRef.value.loop = playMode.value === "loop";
	}
	if (playMode.value === "random") {
		resetRandomMode();
	} else {
		randomIndices.value = [];
		randomIndex.value = -1;
	}
};

// ------------------- 切歌逻辑 -------------------
const getNextTrackId = () => {
	if (!playlistTracks.value.length) return null;
	if (playMode.value === "random" && randomIndices.value.length) {
		let nextPos = randomIndex.value + 1;
		if (nextPos >= randomIndices.value.length) nextPos = 0;
		const nextIdx = randomIndices.value[nextPos];
		return playlistTracks.value[nextIdx]?.id;
	} else {
		let nextIdx = currentTrackIndex.value + 1;
		if (nextIdx >= playlistTracks.value.length) nextIdx = 0;
		return playlistTracks.value[nextIdx]?.id;
	}
};

const getPrevTrackId = () => {
	if (!playlistTracks.value.length) return null;
	if (playMode.value === "random" && randomIndices.value.length) {
		let prevPos = randomIndex.value - 1;
		if (prevPos < 0) prevPos = randomIndices.value.length - 1;
		const prevIdx = randomIndices.value[prevPos];
		return playlistTracks.value[prevIdx]?.id;
	} else {
		let prevIdx = currentTrackIndex.value - 1;
		if (prevIdx < 0) prevIdx = playlistTracks.value.length - 1;
		return playlistTracks.value[prevIdx]?.id;
	}
};

// 切换歌曲（新增 forceAutoPlay 参数）
const switchToSongId = async (newId, forceAutoPlay = false) => {
	if (!newId) return;
	const audio = audioRef.value;
	if (forceAutoPlay) {
		// 自动切歌（如自然播放结束）强制自动播放
		autoPlayNext.value = true;
	} else {
		// 手动切歌：根据当前音频是否在播放来决定
		autoPlayNext.value = audio ? !audio.paused : true;
	}

	const query = {
		id: newId,
	};
	if (playlistId.value) query.playlistId = playlistId.value;
	if (singerId.value) {
		query.singerId = singerId.value;
		query.source = "singer";
	}
	router.replace({ name: "player", query });
};

const nextTrack = () => {
	if (!playlistTracks.value.length) return;
	const nextId = getNextTrackId();
	switchToSongId(nextId, false); // 手动切歌，不强制播放
};

const prevTrack = () => {
	if (!playlistTracks.value.length) return;
	const prevId = getPrevTrackId();
	switchToSongId(prevId, false);
};

// ------------------- 歌曲资源获取 -------------------
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

// ------------------- 播放控制 -------------------
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

const bindAudioEvents = () => {
	const audio = audioRef.value;
	if (!audio) return;

	if (playHandler) audio.removeEventListener("play", playHandler);
	if (pauseHandler) audio.removeEventListener("pause", pauseHandler);
	if (endedHandler) audio.removeEventListener("ended", endedHandler);
	if (timeUpdateHandler) audio.removeEventListener("timeupdate", timeUpdateHandler);
	if (loadedMetadataHandler) audio.removeEventListener("loadedmetadata", loadedMetadataHandler);
	if (canPlayHandler) audio.removeEventListener("canplay", canPlayHandler);

	playHandler = () => {
		isPlaying.value = true;
	};
	pauseHandler = () => {
		isPlaying.value = false;
	};
	endedHandler = () => {
		if (playMode.value === "loop") return;
		const nextId = getNextTrackId();
		if (nextId) {
			switchToSongId(nextId, true); // 自然播放结束，强制自动播放
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
		if (autoPlayNext.value) {
			audio.play().catch(err => console.warn("自动播放失败:", err));
			autoPlayNext.value = false;
		}
	};

	audio.addEventListener("play", playHandler);
	audio.addEventListener("pause", pauseHandler);
	audio.addEventListener("ended", endedHandler);
	audio.addEventListener("timeupdate", timeUpdateHandler);
	audio.addEventListener("loadedmetadata", loadedMetadataHandler);
	audio.addEventListener("canplay", canPlayHandler);

	audio.loop = playMode.value === "loop";
};

// 工具函数
const fmtTime = seconds => {
	if (!seconds || !Number.isFinite(seconds)) return "00:00";
	const s = Math.floor(seconds);
	const m = Math.floor(seconds / 60);
	const rs = s % 60;
	return `${m.toString().padStart(2, "0")}:${rs.toString().padStart(2, "0")}`;
};

// ------------------- 评论功能 -------------------
const fmtCommentTime = timestamp => {
	if (!timestamp) return "未知时间";
	const date = new Date(timestamp);
	return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
};

const fetchComments = async (reset = true) => {
	if (!songId.value) return;
	if (reset) {
		commentPage.value = 1;
		commentHasMore.value = true;
		commentLoading.value = true;
	}
	try {
		const limit = 20;
		const offset = (commentPage.value - 1) * limit;
		const res = await api.get("/comment/music", {
			id: songId.value,
			limit,
			offset,
			sortType: sortType.value,
		});
		const data = res.data || res;
		const newComments = data.comments || [];
		if (reset) {
			comments.value = newComments;
		} else {
			comments.value.push(...newComments);
		}
		commentTotal.value = data.total || 0;
		commentHasMore.value = newComments.length === limit && comments.value.length < commentTotal.value;
	} catch (error) {
		console.error("获取评论失败:", error);
		if (reset) comments.value = [];
	} finally {
		if (reset) commentLoading.value = false;
		commentLoadingMore.value = false;
	}
};

const loadMoreComments = async () => {
	if (!commentHasMore.value || commentLoadingMore.value) return;
	commentLoadingMore.value = true;
	commentPage.value++;
	await fetchComments(false);
};

const openCommentModal = () => {
	isCommentModalVisible.value = true;
	if (comments.value.length === 0 && !commentLoading.value) {
		fetchComments(true);
	}
};

const closeCommentModal = () => {
	isCommentModalVisible.value = false;
};

const stopPropagation = e => e.stopPropagation();

const changeSortType = type => {
	if (sortType.value === type) return;
	sortType.value = type;
	fetchComments(true);
};

// 监听路由变化
watch([source, playlistId, singerId], async () => {
	await loadPlaylist();
	updateCurrentTrackIndex();
});

watch(songId, async () => {
	if (!songId.value) return;
	audioUrl.value = "";
	await Promise.all([fetchSongDetail(), fetchLyrics(), fetchSongUrl()]);
	updateCurrentTrackIndex();
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

watch(audioUrl, () => {
	nextTick(() => bindAudioEvents());
});

watch(playMode, () => {
	if (audioRef.value) audioRef.value.loop = playMode.value === "loop";
	if (playMode.value === "random") resetRandomMode();
	else randomIndices.value = [];
});

watch(isCommentModalVisible, newVal => {
	document.body.style.overflow = newVal ? "hidden" : "";
});

// 生命周期
onMounted(async () => {
	await loadPlaylist();
	updateCurrentTrackIndex();
	await Promise.all([fetchSongDetail(), fetchLyrics(), fetchSongUrl()]);
	nextTick(() => bindAudioEvents());
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
	flex-direction: column;
	padding: 40px 0 0;
	box-sizing: border-box;
}

.player-inner {
	width: 100%;
	max-width: 1200px;
	margin: 0 auto;
	flex: 1;
}

.player-main {
	display: flex;
	gap: 32px;
	flex-wrap: wrap;
}

.player-left {
	flex: 0 0 320px;
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
	min-width: 260px;
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
	max-width: 1200px;
	margin: 0 auto;
	padding: 16px 24px 32px;
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
	.player-main {
		flex-direction: column;
		align-items: center;
	}

	.player-left {
		flex: 0 0 auto;
	}

	.comment-modal-container {
		max-width: 90%;
	}
}
</style>
