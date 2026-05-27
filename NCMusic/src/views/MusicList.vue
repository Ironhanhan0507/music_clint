// MusicList.vue
<script setup>
import { ref, onMounted, computed } from "vue";
import api from "@/api";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
// 得到当前歌单id
const playlistId = computed(() => route.query.id);

const playlistName = ref("");
const tracks = ref([]);
const loading = ref(false);

const fetchPlaylistDetails = async () => {
	loading.value = true;
	try {
		const id = playlistId.value;
		if (!id) return;
		// 把路由传递来的歌单id带到接口里，获取歌单详情数据
		const res = await api.get("/playlist/detail", { id });
		console.log("歌单详情数据:", res);
		const detail = res.playlist;
		if (detail) {
			playlistName.value = detail.name || "未知歌单";
			tracks.value =
				detail.tracks.map(item => ({
					id: item.id,
					name: item.name,
					artist: item.ar.map(artist => artist.name).join(", "),
					album: item.al?.name || "未知专辑",
					duration: item.dt || 0,
				})) || [];
		}
		console.log(tracks.value);
	} catch (error) {
		console.error("Failed to fetch playlist details获取歌单详情失败:", error);
	} finally {
		loading.value = false;
	}
};

// 时间转换
const fmtduration = ms => {
	if (!ms) return "00:00";
	const totalSec = Math.floor(ms / 1000);
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

// 跳转到播放页面 并传递歌曲id + 歌单id
const handlePlaySong = id => {
	if (!id) return;
	router.push({ name: "player", query: { id, playlistId: playlistId.value } });
};

onMounted(() => {
	console.log("当前歌单ID:", playlistId.value);
	fetchPlaylistDetails();
});
</script>

<template>
	<div class="musiclist-page">
		<div class="musiclist-inner">
			<h2 class="title">{{ playlistName }}</h2>
			<div v-if="loading" class="tip">歌曲加载中....</div>
			<ul class="track-list">
				<li class="track-item" v-for="(track, index) in tracks" :key="track.id" @click="handlePlaySong(track.id)">
					<span class="track-index">{{ index + 1 }}</span>
					<div class="track-main">
						<span class="track-name">{{ track.name }}</span>
						<span class="track-artist">{{ track.artist }}</span>
					</div>
					<div class="track-extra">
						<span class="track-album">{{ track.album }}</span>
						<span class="track-duration">{{ fmtduration(track.duration) }}</span>
					</div>
				</li>
			</ul>
		</div>
	</div>
</template>

<style scoped>
.musiclist-page {
	min-height: calc(100vh - 90px);
	padding: 24px 32px;
	box-sizing: border-box;
}

.musiclist-inner {
	max-width: 1200px;
	margin: 0 auto;
}

.title {
	margin: 0 0 16px;
	font-size: 20px;
	font-weight: 600;
}

.tip {
	margin-top: 16px;
	font-size: 14px;
	color: #777;
}

.track-list {
	margin: 12px 0 0;
	padding: 0;
	list-style: none;
	border-radius: 8px;
	background: #fff;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.track-item {
	display: flex;
	align-items: center;
	padding: 8px 16px;
	border-bottom: 1px solid #f2f2f2;
	cursor: pointer;
	font-size: 13px;
}

.track-item:last-of-type {
	border-bottom: none;
}

.track-item:hover {
	background: #fafafa;
}

.track-index {
	width: 32px;
	text-align: right;
	margin-right: 12px;
	color: #999;
	flex-shrink: 0;
}

.track-main {
	display: flex;
	flex-direction: column;
	max-width: 50%;
}

.track-name {
	font-size: 14px;
	color: #333;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.track-artist {
	margin-top: 2px;
	color: #999;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.track-extra {
	display: flex;
	align-items: center;
	gap: 16px;
	margin-left: auto;
	max-width: 40%;
}

.track-album {
	color: #666;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.track-duration {
	color: #999;
	flex-shrink: 0;
}
</style>
