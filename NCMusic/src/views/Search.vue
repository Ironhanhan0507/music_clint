<script setup>
import { ref, computed, onMounted, watch } from "vue";
import api from "@/api";
import { useRoute, useRouter } from "vue-router";
const route = useRoute();
const router = useRouter();

const songList = ref([]);

const loading = ref(false);

const keyWord = computed(() => (route.query.keyword || "").trim().toString());

const fetchSearchResults = async () => {
	loading.value = true;
	const keyword = keyWord.value.trim();
	if (!keyword) return;
	try {
		const res = await api.get("/search", { keywords: keyword, limit: 50 });
		console.log("搜索结果数据:", res);
		songList.value =
			res.result?.songs?.map(item => ({ id: item.id, name: item.name, artists: item.artists.map(artist => artist.name).join(", "), album: item.album.name || "", durationMs: item.duration })) ||
			[];
		console.log("处理后的搜索结果数据:", songList.value);
	} catch (error) {
		console.error("获取搜索结果失败:", error);
		songList.value = [];
	} finally {
		loading.value = false;
	}
};

watch(
	() => keyWord.value,
	(newVal, oldVal) => {
		if (newVal !== oldVal) {
			fetchSearchResults();
		}
	},
);
onMounted(() => {
	if (keyWord.value) {
		fetchSearchResults();
	}
});

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

const handlePlayer = id => {
	if (!id) return;
	router.push({ name: "player", query: { id } });
};
</script>

<template>
	<div class="search-page">
		<div class="search-inner">
			<h2 class="title">搜索结果</h2>
			<p class="keyword" v-if="keyWord">关键词: {{ keyWord }}</p>
			<p v-else class="keyword">请输入关键词进行搜索</p>
			<div v-if="loading" class="tip">正在搜索...</div>
			<div v-else-if="!songList.length && keyWord" class="tip">没有找到相关结果，换个关键词试试吧</div>
			<div v-else class="song-list">
				<ul>
					<li v-for="song in songList" :key="song.id" class="song-item" @click="handlePlayer(song.id)">
						<div class="song-main">
							<span class="song-name">{{ song.name }}</span>
							<span class="song-artist">{{ song.artists }}</span>
						</div>
						<div class="song-extra">
							<p class="song-album">{{ song.album }}</p>
							<p class="song-duration">{{ fmtTime(song.durationMs / 1000) }}</p>
						</div>
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>

<style scoped>
.search-page {
	min-height: calc(100vh - 90px);
	padding: 24px 32px;
	box-sizing: border-box;
}

.search-inner {
	max-width: 1200px;
	margin: 0 auto;
}

.title {
	margin: 0 0 12px;
	font-size: 20px;
	font-weight: 600;
}

.keyword {
	margin: 0 0 16px;
	font-size: 14px;
	color: #666;
}

.tip {
	margin-top: 24px;
	font-size: 14px;
	color: #888;
}

.song-list {
	margin: 16px 0 0;
	padding: 0;
	list-style: none;
	border-radius: 8px;
	background: #fff;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.song-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 16px;
	border-bottom: 1px solid #f2f2f2;
	cursor: pointer;
	font-size: 13px;
}

.song-item:last-of-type {
	border-bottom: none;
}

.song-item:hover {
	background: #fafafa;
}

.song-main {
	display: flex;
	flex-direction: column;
	max-width: 60%;
}

.song-name {
	font-size: 14px;
	color: #333;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.song-artist {
	margin-top: 2px;
	color: #999;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.song-extra {
	display: flex;
	align-items: center;
	gap: 16px;
	max-width: 40%;
	justify-content: flex-end;
}

.song-album {
	color: #666;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.song-duration {
	color: #999;
	flex-shrink: 0;
}
</style>
