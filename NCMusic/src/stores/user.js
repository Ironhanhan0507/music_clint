import { ref, computed } from "vue";
import { defineStore } from "pinia";

export const useUserStore = defineStore("user", () => {
	const user = ref(null);
	// 判断是否登录
	const isLoggedIn = computed(() => !!user.value);

	// 状态管理的存储 pinia和本地存储的同步
	const setUser = payload => {
		if (!payload) return;
		const normalized = {
			id: payload.id,
			nickname: payload.nickname,
			avatar: payload.avatar,
		};
		user.value = normalized;
		localStorage.setItem("user", JSON.stringify(normalized));
	};

	// 清除状态
	const clearUser = () => {
		user.value = null;
		localStorage.removeItem("user");
	};

	// 从本地存储中初始化用户数据
	const initFormalLocal = () => {
		const raw = localStorage.getItem("user");
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (parsed && parsed.id) {
			user.value = parsed;
		}
	};
	initFormalLocal();

	return {
		user,
		isLoggedIn,
		setUser,
		clearUser,
	};
});
