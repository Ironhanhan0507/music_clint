<script setup>
import { ref, onMounted, computed, watch, nextTick, onBeforeUnmount } from "vue";
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

// 评论相关状态
const isCommentModalVisible = ref(false);
const comments = ref([]);
const commentLoading = ref(false);
const commentTotal = ref(0);

const commentPage = ref(1); // 当前页码
const commentHasMore = ref(true); // 是否还有更多评论
const commentLoadingMore = ref(false); // 是否正在加载更多

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

// 监听歌曲ID变化，重新加载数据，并关闭评论弹窗
watch(songId, () => {
	// 重置播放状态
	if (audioRef.value) {
		audioRef.value.pause();
		isPlaying.value = false;
		currentTime.value = 0;
		duration.value = 0;
	}
	// 切换歌曲时关闭评论弹窗并清空评论
	if (isCommentModalVisible.value) {
		isCommentModalVisible.value = false;
	}
	comments.value = [];
	commentTotal.value = 0;
	loadSongData();
});

// 控制body滚动，防止弹窗打开时背景滚动
watch(isCommentModalVisible, newVal => {
	if (newVal) {
		document.body.style.overflow = "hidden";
	} else {
		document.body.style.overflow = "";
	}
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

// 格式化评论时间
const fmtCommentTime = timestamp => {
	if (!timestamp) return "未知时间";
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${year}-${month}-${day}`;
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

// 获取评论（支持分页）
// reset = true 表示重新加载第一页（清空已有评论）
const fetchComments = async (reset = true) => {
	const id = songId.value;
	if (!id) {
		console.warn("无法获取评论: 缺少歌曲ID");
		return;
	}

	if (reset) {
		// 重置分页状态
		commentPage.value = 1;
		comments.value = [];
		commentHasMore.value = true;
		commentLoading.value = true; // 全屏加载状态
	} else {
		if (!commentHasMore.value || commentLoadingMore.value) return;
		commentLoadingMore.value = true;
	}

	try {
		const limit = 30; // 每页条数
		const offset = (commentPage.value - 1) * limit;
		const res = await api.get("/comment/music", {
			id,
			limit,
			offset,
		});

		if (res.code === 200) {
			const newComments = res.comments || [];
			if (reset) {
				comments.value = newComments;
			} else {
				comments.value = [...comments.value, ...newComments];
			}
			commentTotal.value = res.total || 0;
			// 判断是否还有更多
			commentHasMore.value = comments.value.length < commentTotal.value;
			// 如果当前有排序规则，重新排序（可选）
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
// 打开评论弹窗
const openCommentModal = () => {
	if (!songId.value) return;
	isCommentModalVisible.value = true;
	fetchComments(true); // 重置并加载第一页
};

// 关闭评论弹窗
const closeCommentModal = () => {
	isCommentModalVisible.value = false;
};

// 阻止弹窗内容区域的点击事件冒泡，防止点击内容区域关闭弹窗
const stopPropagation = e => {
	e.stopPropagation();
};

// 排序相关
const sortType = ref("hot"); // 'hot' 热度排序，'time' 时间排序

// 对评论进行排序（原地排序）
const applySort = () => {
	if (!comments.value.length) return;
	if (sortType.value === "hot") {
		comments.value.sort((a, b) => (b.likedCount || 0) - (a.likedCount || 0));
	} else if (sortType.value === "time") {
		comments.value.sort((a, b) => (b.time || 0) - (a.time || 0));
	}
};

// 切换排序方式
const changeSortType = type => {
	if (sortType.value === type) return;
	sortType.value = type;
	applySort();
};

onMounted(() => {
	console.log("当前歌曲ID:", songId.value);
	loadSongData();
});

onBeforeUnmount(() => {
	// 组件卸载前恢复body滚动
	document.body.style.overflow = "";
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
						<!-- <div v-else class="comment-loading">
							<div class="loading-spinner"></div>
							<span>加载评论中...</span>
						</div> -->
					</div>
				</div>
			</div>
		</Teleport>
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
	font-size: 13px;
	color: #bbb;
	margin-bottom: 18px;
	font-weight: 500;
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
</style>
