<script setup>
import { ref, computed, onMounted } from "vue";
import api from "@/api";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
const userStore = useUserStore();
const router = useRouter();

// 获取用户歌单
const playlists = ref([]);
// 网络请求获取用户歌单数据
const fetchUserPlaylists = async () => {
	const uid = userStore.user?.id;
	try {
		if (!uid) return;
		const res = await api.get("/user/playlist", { uid });
		console.log("用户歌单数据:", res);
		playlists.value = res.playlist?.map(item => ({ id: item.id, name: item.name, cover: item.coverImgUrl, trackCount: item.trackCount })) || [];
		console.log("处理后的歌单数据:", playlists.value);
	} catch (error) {
		console.error("获取用户歌单失败:", error);
		playlists.value = [];
	}
};
onMounted(() => {
	fetchUserPlaylists();
});

// 跳转到登录页
const handleGologin = () => {
	router.push("/login");
};

// 打开歌单详情页
const handleOpenPlayList = id => {
	if (!id) return;
	router.push({ name: "musiclist", query: { id } });
};
</script>

<template>
	<div class="mymusic-page">
		<div class="mymusic-inner">
			<h2 class="title">我的音乐</h2>
			<div class="login-hint" v-if="!userStore.isLoggedIn">
				<p class="hint-text">请先登录以查看您的音乐</p>
				<button class="hint-btn" @click="handleGologin" type="button">去登录</button>
			</div>
			<div v-else>
				<p class="subtitle">我的歌单</p>
				<div v-if="!playlists.length" class="tip">暂无歌单，快去音乐馆收藏一些音乐吧</div>
				<ul v-else class="playlist-list">
					<li v-for="item in playlists" :key="item.id" class="playlist-item" @click="handleOpenPlayList(item.id)">
						<div class="cover">
							<img :src="item.cover" alt="" />
						</div>
						<div class="info">
							<p class="name">{{ item.name }}</p>
							<p class="count">共{{ item.trackCount }}首</p>
						</div>
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>

<style scoped>
.mymusic-page {
	min-height: calc(100vh - 90px);
	padding: 24px 32px;
	box-sizing: border-box;
}

.mymusic-inner {
	max-width: 1200px;
	margin: 0 auto;
}

.title {
	margin: 0 0 16px;
	font-size: 20px;
	font-weight: 600;
}

.subtitle {
	margin: 0 0 12px;
	font-size: 16px;
	color: #333;
}

.login-hint {
	margin-top: 24px;
	padding: 24px 28px;
	border-radius: 8px;
	background: #fff;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.hint-text {
	margin: 0 0 12px;
	font-size: 14px;
	color: #555;
}

.hint-btn {
	padding: 6px 16px;
	border-radius: 16px;
	border: none;
	background: #c20c0c;
	color: #fff;
	font-size: 14px;
	cursor: pointer;
}

.hint-btn:hover {
	background: #a00a0a;
}

.tip {
	margin-top: 16px;
	font-size: 14px;
	color: #777;
}

.playlist-list {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 16px;
	list-style: none;
	margin: 12px 0 0;
	padding: 0;
}

.playlist-item {
	background: #fff;
	border-radius: 8px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	overflow: hidden;
}

.cover {
	width: 100%;
	aspect-ratio: 1/1;
	overflow: hidden;
}

.cover img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.info {
	padding: 8px 10px 10px;
}

.name {
	margin: 0 0 4px;
	font-size: 14px;
	color: #333;
	/* 暂时注释，测试文字是否显示 */
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.count {
	margin: 0;
	font-size: 12px;
	color: #999;
}
</style>
