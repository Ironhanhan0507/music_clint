<script setup>
import { ref, onMounted, watch } from "vue";
import api from "@/api";
import { useUserStore } from "@/stores/user";
import { useRouter } from "vue-router";

const userStore = useUserStore();
const router = useRouter();
// 二维码图片地址
const qrImg = ref("");

// 登录二维码的key
const loginKey = ref("");

// 轮询定时器
const qrCheckTimer = ref(null);

// 获取登录二维码的key
const fetchLoginKey = async () => {
	try {
		const res = await api.get("/login/qr/key");
		console.log("登录二维码key数据:", res);
		loginKey.value = res.data?.unikey || "";
	} catch (error) {
		console.error("获取登录二维码key失败:", error);
		loginKey.value = "";
	}
};

// 根据key获取登录二维码图片
const fetchQrImage = async key => {
	if (!key) return;
	try {
		const res = await api.get("/login/qr/create", {
			key: loginKey.value,
			timestamp: Date.now(),
			qrimg: true,
			ua: "pc",
		});
		console.log("登录二维码图片数据:", res);
		qrImg.value = res.data?.qrimg || "";
	} catch (error) {
		console.error("获取登录二维码图片失败:", error);
		qrImg.value = "";
	}
};

// 监听登录二维码key变化，获取二维码图片
watch(
	() => loginKey.value,
	val => {
		if (val) {
			fetchQrImage(val);
		}
	},
);
// 轮询二维码状态
const startQrCheck = key => {
	if (!key) return;
	if (qrCheckTimer.value) {
		clearInterval(qrCheckTimer.value);
	}
	// 发送网络请求检查二维码状态
	qrCheckTimer.value = setInterval(async () => {
		try {
			const res = await api.get("/login/qr/check", {
				key,
				timestamp: Date.now(),
				ua: "pc",
			});
			console.log("登录二维码状态数据:", res);
			const code = res.code;
			if (code === 800) {
				// 二维码过期
				clearInterval(qrCheckTimer.value);
				qrCheckTimer.value = null;
				console.warn("登录二维码已过期");
			} else if (code === 801) {
				// 等待扫码
				console.log("等待扫码...");
			} else if (code === 802) {
				// 已扫码，等待确认
				console.log("已扫码，等待确认...");
			} else if (code === 803) {
				// 登录成功
				clearInterval(qrCheckTimer.value);
				qrCheckTimer.value = null;
				console.log("登录成功!");
			}
			// 授权成功后再调用登录状态获取用户信息
			const statusRes = await api.get("/login/status", {
				timestamp: Date.now(),
				ua: "pc",
			});
			const profile = statusRes.data?.profile || statusRes.profile || statusRes.account;
			if (profile) {
				// console.log("登录用户信息:", profile);
				// 存储用户数据
				userStore.setUser({ userId: profile.userId, nickname: profile.nickname, avatarUrl: profile.avatarUrl });
			} else {
				console.warn("未获取到登录用户信息");
			}
			router.push("/"); // 登录成功后跳转到主页
		} catch (error) {
			console.error("检查登录二维码状态失败:", error);
		}
	}, 3000); // 每3秒检查一次
};

watch(
	() => qrImg.value,
	val => {
		if (val && loginKey.value) {
			startQrCheck(loginKey.value);
		}
	},
);

onMounted(() => {
	fetchLoginKey();
});

// 点击空白关闭登录界面
const handleOverlayClick = e => {
	if (e.target === e.currentTarget) {
		router.push("/");
	}
};
</script>

<template>
	<div class="login-overlay" @click="handleOverlayClick">
		<div class="login-modal">
			<div class="login-header">
				<h2>扫码登录</h2>
				<p>使用网易云音乐APP扫码登录</p>
			</div>
			<div class="login-body">
				<div class="qrcode-box">
					<div class="qrcode-placeholder">
						<template v-if="qrImg">
							<img :src="qrImg" alt="登录二维码" />
						</template>
						<template v-else>
							<span>二维码加载中</span>
						</template>
					</div>
					<p class="qrcode-tip">打开网易云音乐App扫描二维码登录</p>
				</div>
				<ul class="loginfeatures">
					<li>同步您的音乐收藏和播放记录</li>
					<li>多端同步，随时随地畅听音乐</li>
					<li>扫码登录更安全</li>
				</ul>
			</div>
		</div>
	</div>
</template>

<style scoped>
.login-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.4);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 999;
}

.login-modal {
	width: 420px;
	padding: 24px 32px 32px;
	border-radius: 8px;
	background: #ffffff;
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
	box-sizing: border-box;
}

.login-header h2 {
	margin: 0;
	font-size: 20px;
	color: #333;
}

.login-header p {
	margin: 8px 0 0;
	font-size: 13px;
	color: #666;
}

.login-body {
	margin-top: 20px;
	display: flex;
	gap: 20px;
}

.qrcode-box {
	text-align: center;
}

.qrcode-placeholder {
	width: 140px;
	height: 140px;
	border-radius: 4px;
	background: #f5f5f5;
	border: 1px solid #e1e1e1;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #999;
	font-size: 14px;
}

.qrcode-placeholder img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.qrcode-tip {
	margin-top: 8px;
	font-size: 12px;
	color: #666;
}

.login-features {
	list-style: none;
	padding: 0;
	margin: 0;
	font-size: 13px;
	color: #555;
}

.login-features li + li {
	margin-top: 8px;
}
</style>
