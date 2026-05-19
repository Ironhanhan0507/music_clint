import axios from "axios";

// 创建一个 axios 实例
const request = axios.create({
	baseURL: "http://localhost:3000",
	timeout: 5000,
	withCredentials: true, // 允许携带 cookie
});

// 请求拦截器
request.interceptors.request.use(
	config => {
		// 在发送请求之前做一些处理，例如添加认证 token
		const token = localStorage.getItem("token");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	error => {
		// 对请求错误做些什么
		return Promise.reject(error);
	},
);

// 响应拦截器
request.interceptors.response.use(
	response => {
		// 对响应数据做点什么
		return response.data;
	},
	error => {
		// 对响应错误做点什么
		// 处理全局错误，例如 401 未登录
		return Promise.reject(error);
	},
);

//  GET / POST 封装
export function get(url, params = {}, config = {}) {
	return request.get(url, { params, ...config });
}
export function post(url, data = {}, config = {}) {
	return request.post(url, data, { ...config });
}

const api = { get, post };
export default api;
