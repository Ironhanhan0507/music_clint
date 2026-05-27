<template>
	<div class="singer-page">
		<div v-if="loading" class="loading">加载中...</div>
		<div v-else-if="error" class="error">{{ error }}</div>
		<div v-else class="singer-container">
			<!-- 歌手头部信息 -->
			<div class="singer-header">
				<div class="singer-avatar">
					<img :src="singerInfo.avatar" :alt="singerInfo.name" />
				</div>
				<div class="singer-info">
					<h1 class="singer-name">{{ singerInfo.name }}</h1>
					<p class="singer-brief">{{ singerInfo.briefDesc || "暂无简介" }}</p>
					<div class="singer-counts">
						<span>歌曲数：{{ singerInfo.musicSize || 0 }}</span>
						<span>专辑数：{{ singerInfo.albumSize || 0 }}</span>
					</div>
				</div>
			</div>

			<!-- 热门单曲列表 -->
			<div class="songs-section">
				<h2 class="section-title">热门单曲</h2>
				<ul class="song-list">
					<li v-for="song in hotSongs" :key="song.id" class="song-item" @click="playSong(song.id)">
						<div class="song-index">{{ song.index }}</div>
						<div class="song-info">
							<div class="song-name">{{ song.name }}</div>
							<div class="song-artist">{{ song.artists }}</div>
						</div>
						<div class="song-duration">{{ formatDuration(song.duration) }}</div>
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/api";

const route = useRoute();
const router = useRouter();

const singerId = ref(null);
const singerInfo = ref({
	name: "",
	avatar: "",
	briefDesc: "",
	musicSize: 0,
	albumSize: 0,
});
const hotSongs = ref([]);
const loading = ref(true);
const error = ref("");

// 播放歌曲
const playSong = songId => {
	if (!songId) return;
	router.push({
		name: "player",
		query: {
			id: songId,
			singerId: singerId.value,
			source: "singer",
		},
	});
};
// 格式化时长（毫秒转 mm:ss）- 修复版
const formatDuration = ms => {
	if (!ms || isNaN(ms)) return "00:00";
	const minutes = Math.floor(ms / 60000);
	const seconds = Math.floor((ms % 60000) / 1000);
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// 获取歌手详情和热门歌曲 - 修复字段映射
const fetchSingerDetail = async id => {
	try {
		const response = await api.get("/artists", { id });
		const data = response?.data || response;

		if (!data || data.code !== 200) {
			throw new Error(data?.message || "获取歌手信息失败");
		}

		const artist = data.artist;
		if (!artist) {
			throw new Error("歌手信息不存在");
		}

		singerInfo.value = {
			name: artist.name || "未知歌手",
			avatar: artist.picUrl || "",
			briefDesc: artist.briefDesc || "",
			musicSize: artist.musicSize || 0,
			albumSize: artist.albumSize || 0,
		};

		// 确保热门歌曲是数组
		const songs = Array.isArray(data.hotSongs) ? data.hotSongs : [];
		hotSongs.value = songs.map((song, idx) => {
			// 兼容艺术家字段：网易云返回 ar 数组，每个元素有 name
			let artistNames = [];
			if (song.ar && Array.isArray(song.ar)) {
				artistNames = song.ar.map(artist => artist.name);
			} else if (song.artists && Array.isArray(song.artists)) {
				artistNames = song.artists.map(artist => artist.name);
			}
			const artistsStr = artistNames.join(", ") || "未知艺术家";

			// 时长字段：网易云常用 dt（毫秒），也可能用 duration
			let durationMs = song.dt || song.duration || 0;
			// 如果 dt 或 duration 不存在，尝试从其他字段获取（如 song.duration 可能是字符串）
			if (!durationMs && song.duration) durationMs = parseInt(song.duration);
			if (isNaN(durationMs)) durationMs = 0;

			return {
				id: song.id,
				index: idx + 1,
				name: song.name || "未知歌曲",
				artists: artistsStr,
				duration: durationMs,
			};
		});
	} catch (err) {
		console.error("获取歌手详情失败:", err);
		error.value = err.message || "加载失败，请稍后重试";
	} finally {
		loading.value = false;
	}
};

onMounted(() => {
	const id = route.query.id;
	if (!id) {
		error.value = "缺少歌手ID参数";
		loading.value = false;
		return;
	}
	singerId.value = id;
	fetchSingerDetail(id);
});
</script>

<style scoped>
/* 样式保持不变，与之前相同 */
.singer-page {
	min-height: 100vh;
	background: #f8f9fa;
	padding: 40px 20px;
}

.singer-container {
	max-width: 1000px;
	margin: 0 auto;
	background: #fff;
	border-radius: 16px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	padding: 30px;
}

.loading,
.error {
	text-align: center;
	padding: 60px;
	font-size: 16px;
	color: #666;
}

.error {
	color: #ff4d4f;
}

.singer-header {
	display: flex;
	gap: 30px;
	padding-bottom: 30px;
	border-bottom: 1px solid #eee;
	margin-bottom: 30px;
}

.singer-avatar {
	flex-shrink: 0;
	width: 180px;
	height: 180px;
	border-radius: 50%;
	overflow: hidden;
	background: #f0f0f0;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.singer-avatar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.singer-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
}

.singer-name {
	font-size: 32px;
	font-weight: 600;
	margin: 0 0 12px;
	color: #333;
}

.singer-brief {
	font-size: 14px;
	color: #666;
	line-height: 1.6;
	margin: 0 0 16px;
}

.singer-counts {
	display: flex;
	gap: 24px;
	font-size: 14px;
	color: #999;
}

.section-title {
	font-size: 24px;
	font-weight: 600;
	margin: 0 0 20px;
	color: #333;
	padding-left: 8px;
	border-left: 4px solid #ff5e5e;
}

.song-list {
	list-style: none;
	padding: 0;
	margin: 0;
}

.song-item {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 12px 16px;
	border-radius: 8px;
	cursor: pointer;
	transition: background 0.2s;
}

.song-item:hover {
	background: #f5f5f5;
}

.song-index {
	width: 40px;
	font-size: 16px;
	color: #999;
	text-align: center;
}

.song-info {
	flex: 1;
}

.song-name {
	font-size: 16px;
	font-weight: 500;
	color: #333;
	margin-bottom: 4px;
}

.song-artist {
	font-size: 12px;
	color: #999;
}

.song-duration {
	font-size: 14px;
	color: #999;
	width: 60px;
	text-align: right;
}

@media (max-width: 768px) {
	.singer-container {
		padding: 20px;
	}
	.singer-header {
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.singer-avatar {
		width: 140px;
		height: 140px;
	}
	.singer-name {
		font-size: 24px;
	}
	.song-index {
		width: 30px;
	}
}
</style>
