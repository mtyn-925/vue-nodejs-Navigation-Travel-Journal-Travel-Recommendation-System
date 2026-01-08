import { createRouter, createWebHistory } from 'vue-router';
import LoginRegister from '../components/LoginRegister.vue'; // 登录页面
import DiaryPage from '../components/DiaryPage.vue'; // 日记页面
import PublishDiary from '../components/PublishDiary.vue'; // 发布日记页面（新增！）
import Recommend from '../components/Recommend.vue';//旅游推荐
import AIGC from '../components/AIGC.vue';//AIGC
import AJPG from '../components/AJPG.vue';//AJPG
import MapView from '../components/MapView.vue'
import Ne from '../components/Ne.vue';//旅游推荐


const routes = [
  { path: '/', component: LoginRegister },  // 登录页面
  { path: '/diary', name: 'diary', component: DiaryPage },  // 日记查看页面
  { path: '/publish', name: 'publish', component: PublishDiary }, // 发布日记页面（新增）
  { path: '/recommend', name: 'recommend', component: Recommend },
  { path: '/AIGC', name: 'AIGC', component: AIGC },
  { path: '/AJPG', name: 'AJPG', component: AJPG },
  { path: '/map', name: 'Map', component: MapView },
  { path: '/Ne', name: 'Ne', component: Ne },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
