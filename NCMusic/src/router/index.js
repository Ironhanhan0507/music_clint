import { createRouter, createWebHistory } from "vue-router";
import MusicHall from "../views/MusicHall.vue";

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: "/",
			name: "musichall",
			component: MusicHall,
		},
		{
			path: "/mymusic",
			name: "mymusic",
			component: () => import("../views/MyMusic.vue"),
		},
		{
			path: "/login",
			name: "login",
			component: () => import("../views/Login.vue"),
		},
		{
			path: "/search",
			name: "search",
			component: () => import("../views/Search.vue"),
		},
		{
			path: "/player",
			name: "player",
			component: () => import("../views/Player.vue"),
		},
		{
			path: "/musiclist",
			name: "musiclist",
			component: () => import("../views/MusicList.vue"),
		},
	],
});

export default router;
