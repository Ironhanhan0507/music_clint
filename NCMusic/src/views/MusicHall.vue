<script setup>
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import api from "@/api";

const router = useRouter();

// 推荐歌单
const playlists = ref([]);
// 推荐新音乐
const newSongs = ref([]);
// 歌手榜单
const singerList = ref([]);

// 当前展示的歌手的轮播图索引
const currentSingerSlide = ref(0);

// 默认每个轮播图展示的数据量
const SINGER_PAGE_SIZE = 5;

// 处理每个轮播图的数据:左右切换
const singerSlides = computed(() => {
	// list为每一页的5条数据
	const list = singerList.value || [];
	// 所有轮播图的页数的数据
	const slides = [];
	for (let i = 0; i < list.length; i += SINGER_PAGE_SIZE) {
		slides.push(list.slice(i, i + SINGER_PAGE_SIZE));
	}
	return slides;
});

// 左右切换按钮事件
const prevSingerSlide = () => {
	if (!singerSlides.value.length) return;
	currentSingerSlide.value = (currentSingerSlide.value - 1 + singerSlides.value.length) % singerSlides.value.length;
};

const nextSingerSlide = () => {
	if (!singerSlides.value.length) return;
	currentSingerSlide.value = (currentSingerSlide.value + 1) % singerSlides.value.length;
};

const fetchPlaylists = async () => {
	try {
		const data = await api.get("/personalized", { limit: 5 });
		playlists.value = (data.result || []).map(item => ({
			id: item.id,
			title: item.name,
			desc: item.copywriter || "",
			cover: item.picUrl,
		}));
	} catch (error) {
		console.error("Failed to fetch playlists获取歌单失败:", error);
	}
};

const fetchNewSongs = async () => {
	try {
		const data = await api.get("/personalized/newsong", { limit: 10 });
		newSongs.value = (data.result || []).map(item => ({
			id: item.id,
			name: item.name,
			cover: item.picUrl,
			artist: item.song.artists.map(artist => artist.name).join(",") || "未知艺术家",
		}));
	} catch (error) {
		console.error("Failed to fetch new songs获取新歌失败:", error);
	}
};

const fetchSingerList = async () => {
	try {
		const data = await api.get("/top/artists", { limit: 20 });
		singerList.value = (data.artists || []).map((artist, index) => ({
			id: artist.id,
			name: artist.name,
			rank: index + 1,
			avatar: artist.picUrl,
		}));
	} catch (error) {
		console.error("Failed to fetch singer list获取歌手榜单失败:", error);
	}
};

onMounted(() => {
	fetchPlaylists();
	fetchNewSongs();
	fetchSingerList();
});

// 点击歌单跳转详情携带歌单id
const handlePlayListClick = id => {
	// 这里可以使用路由跳转到歌单详情页，携带歌单id参数
	if (!id) return;
	router.push({
		name: "musiclist",
		query: { id },
	});
};
</script>

<template>
	<!-- 推荐歌单 -->
	<div class="hall-wrapper">
		<div class="hall-inner">
			<h2 class="section-title">推荐歌单</h2>
			<ul class="playlist-list">
				<li class="playlist-item" v-for="item in playlists" :key="item.id" @click="handlePlayListClick(item.id)">
					<div class="cover-wrapper">
						<img :src="item.cover" :alt="item.title" />
					</div>
					<div class="info">
						<h3 class="title">{{ item.title }}</h3>
						<p class="desc">{{ item.desc }}</p>
					</div>
				</li>
			</ul>
			<!-- 推荐新音乐 -->
			<h2 class="section-title section-title--sub">推荐新音乐</h2>
			<ul class="song-list">
				<li class="song-item" v-for="song in newSongs" :key="song.id">
					<div class="song-cover">
						<img :src="song.cover" :alt="song.name" />
					</div>
					<div class="song-info">
						<h3 class="song-name">{{ song.name }}</h3>
						<p class="song-artist">{{ song.artist }}</p>
					</div>
				</li>
			</ul>
			<!-- 歌手榜单 -->
			<h2 class="section-title section-title--sub section-title--singer">歌手榜单</h2>
			<div class="singer-carousel" v-if="singerSlides.length">
				<div class="singer-carousel-track">
					<div class="singer-slide" v-for="(slide, index) in singerSlides" :key="index" v-show="currentSingerSlide === index">
						<ul class="singer-list">
							<li class="singer-item" v-for="singer in slide" :key="singer.id">
								<div class="singer-avatar">
									<img :src="singer.avatar" :alt="singer.name" />
								</div>
								<span class="singer-name">{{ singer.rank }} {{ singer.name }}</span>
							</li>
						</ul>
					</div>
				</div>
				<!-- 切换按钮 -->
				<div class="singer-carousel-controls" v-if="singerSlides.length > 1">
					<button class="singer-arrow" @click="prevSingerSlide">&#8249;</button>
					<button class="singer-arrow" @click="nextSingerSlide">&#8250;</button>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.hall-wrapper {
	display: flex;
	justify-content: center;
}

.hall-inner {
	width: 100%;
	max-width: 1200px;
}

.section-title {
	margin: 0 0 16px;
	margin-top: 40px;
	font-size: 20px;
	font-weight: 600;
	color: #333;
}

.section-title--sub {
	margin-top: 40px;
}

.section-title--singer {
	margin-top: 68px;
	font-size: 22px;
	text-align: center;
}

.playlist-list {
	display: flex;
	gap: 20px;
	list-style: none;
	padding: 0;
	margin: 0;
}

.playlist-item {
	flex: 1;
	max-width: 220px;
	cursor: pointer;
}

.cover-wrapper {
	width: 100%;
	aspect-ratio: 1 / 1;
	border-radius: 4px;
	overflow: hidden;
	background: #eee;
	cursor: pointer;
}

.cover-wrapper img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
	transition: transform 0.3s ease;
}

.cover-wrapper:hover img {
	transform: scale(1.06);
}

.info {
	margin-top: 8px;
}

.title {
	font-size: 14px;
	color: #333;
	margin: 0 0 4px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.desc {
	font-size: 12px;
	color: #999;
	margin: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.song-list {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 16px 40px;
	list-style: none;
	padding: 0;
	margin: 0;
}

.song-item {
	display: flex;
	align-items: center;
	gap: 12px;
	cursor: pointer;
}

.song-cover {
	width: 82px;
	height: 82px;
	border-radius: 4px;
	overflow: hidden;
	background: #eee;
	flex-shrink: 0;
	cursor: pointer;
}

.song-cover img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
	transition: transform 0.3s ease;
}

.song-cover:hover img {
	transform: scale(1.2);
}

.song-info {
	flex: 1;
}

.song-name {
	font-size: 14px;
	color: #333;
	margin: 0 0 4px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.song-artist {
	font-size: 12px;
	color: #999;
	margin: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.singer-list {
	margin: 16px 0 0;
	padding: 0;
	list-style: none;
	display: flex;
	justify-content: space-between;
}

.singer-item {
	width: 20%;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	cursor: pointer;
}

.singer-avatar {
	width: 160px;
	height: 160px;
	border-radius: 50%;
	overflow: hidden;
	background: #eee;
	flex-shrink: 0;
}

.singer-avatar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.singer-name {
	font-size: 16px;
	color: #333;
	text-align: center;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.singer-carousel {
	margin-top: 12px;
	position: relative;
}

.singer-carousel-track {
	position: relative;
	min-height: 200px;
}

.singer-slide {
	width: 100%;
}

.singer-carousel-controls {
	position: absolute;
	inset: 0;
	margin: 0;
	pointer-events: none;
}

.singer-arrow {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
	width: 44px;
	height: 44px;
	border-radius: 50%;
	border: none;
	background: #f2f2f2;
	cursor: pointer;
	font-size: 22px;
	line-height: 1;
	pointer-events: auto;
}

.singer-arrow:first-of-type {
	left: -30px;
}

.singer-arrow:last-of-type {
	right: -30px;
}

.singer-arrow:hover {
	background: #e5e5e5;
}
</style>
