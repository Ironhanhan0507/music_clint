<script setup>
import { RouterLink, RouterView } from "vue-router";
import { ref } from "vue";
//搜索内容
// 使用 ref 创建了一个响应式的搜索关键词变量
const searchKeyword = ref("");
const handleSearch = () => {
	const keyword = searchKeyword.value.trim();
	console.log(keyword);
};
</script>

<template>
	<div class="app">
		<header class="top-nav">
			<div class="top-nav-inner">
				<div class="logo"><a hidefocus="true" href="/#">网易云音乐</a></div>
				<nav class="nav-links">
					<RouterLink class="nav-link" to="/">音乐馆</RouterLink>
					<RouterLink class="nav-link" to="/mymusic">我的音乐</RouterLink>
				</nav>
				<div class="nav-actions">
					<div class="search-box">
						<input type="text" class="search-input" v-model="searchKeyword" @keyup.enter="handleSearch" placeholder="音乐/歌手/专辑" />
					</div>
					<RouterLink to="/login" class="login-btn">登录</RouterLink>
				</div>
			</div>
		</header>
		<main class="main-view">
			<RouterView />
		</main>
	</div>
</template>

<style scoped>
.app {
	min-height: 100vh;
	display: flex;
	flex-direction: column;
	background: #f5f7fb;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
}

.top-nav {
	height: 90px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #242424;
	color: #333;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.top-nav-inner {
	width: 100%;
	max-width: 1200px;
	padding: 0 32px;
	display: flex;
	align-items: center;
	justify-content: flex-start;
}

.logo {
	background: url(./assets/imgs/topbar.png) no-repeat 0 9999px;
	float: left;
	width: 176px;
	height: 69px;
	background-position: 0 0;
}

.logo a {
	float: left;
	width: 157px;
	height: 100%;
	padding-right: 20px;
	text-indent: -9999px;
}

.nav-links {
	display: flex;
	gap: 24px;
	margin-left: 24px;
}

.nav-link {
	color: #e5e5e5;
	text-decoration: none;
	font-size: 16px;
	padding: 8px 16px;
	border-radius: 18px;
	transition: all 0.2s;
}

.nav-link:hover {
	color: #fff;
	background: #c20c0c;
}

.nav-link.router-link-active {
	color: #fff;
	background: #c20c0c;
}

.nav-actions {
	display: flex;
	align-items: center;
	margin-left: auto;
}

.user-menu {
	position: relative;
}

.search-box {
	margin-right: 16px;
}

.search-input {
	width: 180px;
	height: 32px;
	padding: 0 12px;
	border-radius: 16px;
	border: none;
	outline: none;
	background: #fff;
	font-size: 13px;
}

.search-input::placeholder {
	color: #999;
}

.login-btn {
	padding: 6px 16px;
	border-radius: 999px;
	border: 1px solid #c20c0c;
	color: #c20c0c;
	font-size: 14px;
	text-decoration: none;
	transition: all 0.2s;
}

.login-btn:hover {
	background: #c20c0c;
	color: #ffffff;
}

.user-avatar {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	padding: 0;
	border: none;
	outline: none;
	background: transparent;
	cursor: pointer;
	overflow: hidden;
}

.user-avatar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
	border-radius: 50%;
}

.user-dropdown {
	position: absolute;
	top: 36px;
	right: 0;
	min-width: 140px;
	padding: 8px 0;
	border-radius: 8px;
	background: #2d2d2d;
	box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
	opacity: 0;
	pointer-events: none;
	transform: translateY(4px);
	transition:
		opacity 0.15s ease,
		transform 0.15s ease;
}

.user-dropdown-header {
	padding: 4px 14px 6px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	margin-bottom: 4px;
}

.user-name {
	font-size: 12px;
	color: #f5f5f5;
}

.user-dropdown-item {
	width: 100%;
	padding: 6px 14px;
	border: none;
	background: transparent;
	color: #f5f5f5;
	font-size: 12px;
	text-align: left;
	cursor: pointer;
}

.user-dropdown-item:hover {
	background: rgba(255, 255, 255, 0.06);
}

.user-menu:hover .user-dropdown {
	opacity: 1;
	pointer-events: auto;
	transform: translateY(0);
}

.main-view {
	flex: 1;
}
</style>
