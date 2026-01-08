import { createApp } from 'vue';
import App from './App.vue';
import router from './router'; // 导入你刚才写的router
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

const app = createApp(App);
app.use(ElementPlus);
app.use(router); // ⬅️ 这里一定要use(router)
app.mount('#app');
