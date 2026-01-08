<template>
    <div class="container">
        <div class="search-bar">
            <input type="text" v-model="query" placeholder="搜索地点或热度..." class="search-input" />
            <!-- 新增分类筛选下拉框 -->
            <select v-model="categoryFilter" @change="onSearch" class="category-select">
                <option value="">所有分类</option>
                <option v-for="category in uniqueCategories" :key="category" :value="category">{{ category }}</option>
            </select>
            <select v-model="filter" @change="onSearch" class="filter-select">
                <option value="hotness">按热度</option>
                <option value="rating">按评分</option>
            </select>
            <!-- 搜索按钮 -->
            <button @click="onSearch" class="search-button">搜索</button>
        </div>

        <div class="recommendation">
            <div v-if="loading" class="loading-state">
                <div class="loader"></div>
                正在加载推荐...
            </div>

            <div v-else-if="error" class="error-state">
                ❌ 加载失败：{{ error }}
                <button @click="onSearch">重试</button>
            </div>

            <div v-else class="recommendation-list">
                <div v-for="item in currentRecommendations" :key="item.osm_id" class="recommendation-card"
                    @click="onCardClick(item)">
                    <div class="cover-img-wrapper">
                        <img :src="item.cover || '/path/to/default/image.jpg'" :alt="item.name" class="cover-img" />
                    </div>
                    <h3>{{ item.name }}</h3>
                    <p class="popularity">热度值：{{ item.popularity.toFixed(0) }}</p>
                    <p class="views">访问量：{{ item.views }}</p>


                    <!-- 显示评分信息 -->
                    <p v-if="item.rating_count > 0" class="rating">
                        评分：{{ item.rating }}（{{ item.rating_count }}人评分）
                    </p>
                    <p v-else class="rating">暂无评分</p>
                </div>
            </div>

            <!-- 分页部分 -->
            <div v-if="filteredRecommendations.length > 0" class="pagination">
                <button @click="changePage(1)" :disabled="currentPage === 1">1</button>
                <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1">‹</button>

                <!-- 显示当前页和附近的页码 -->
                <button v-for="page in visiblePageNumbers" :key="page" @click="changePage(page)"
                    :class="{ active: currentPage === page }">
                    {{ page }}
                </button>

                <!-- 初始加载时显示省略号 -->
                <span v-if="isInitialLoad && currentPage < 5">...</span>

                <button @click="changePage(currentPage + 1)" :disabled="currentPage === totalPages">›</button>
                <button @click="changePage(totalPages)" :disabled="currentPage === totalPages">{{ totalPages }}</button>
            </div>
        </div>

        <!-- 修改后的模态卡片 -->
        <div v-if="selectedItem" class="modal" @click="closeModal">
            <div class="modal-content" @click.stop>
                <!-- 图片区域（调整宽高比） -->
                <div class="modal-img-container">
                    <img :src="selectedItem.cover || '/path/to/default/image.jpg'" :alt="selectedItem.name"
                        class="modal-img" />
                </div>

                <!-- 内容区域（可滚动） -->
                <div class="modal-scroll-content">
                    <h3>{{ selectedItem.name }}</h3>

                    <div class="info-section">
                        <p class="popularity">热度值：{{ selectedItem.popularity.toFixed(0) }}</p>
                        <p class="views">访问量：{{ selectedItem.views }}</p>
                        <p class="category">分类：{{ selectedItem.fclass }}</p>
                    </div>

                    <!-- 评分组件 -->
                    <div class="rating-section">
                        <div class="stars">
                            <span v-for="n in 5" :key="n" class="star"
                                :class="{ active: n <= currentRating, hover: hoverRating > 0 && n <= hoverRating }"
                                @click="setRating(n)" @mouseover="hoverRating = n" @mouseout="hoverRating = 0">★</span>
                        </div>
                        <div class="rating-info">
                            <span v-if="selectedItem.rating_count > 0">
                                评分：{{ selectedItem.rating }}（{{ selectedItem.rating_count }}人评分）
                            </span>
                            <span v-else>暂无评分</span>
                        </div>
                    </div>

                    <!-- 新增的简介栏 -->
                    <div v-if="selectedItem.description" class="description-section">
                        <h4>景点简介</h4>
                        <p>{{ selectedItem.description }}</p>
                    </div>
                </div>
            </div> <!-- 闭合 modal-content -->
        </div> <!-- 闭合 modal -->
    </div> <!-- 闭合 container -->
</template>

<script>
import axios from 'axios';

export default {
    name: 'RecommendComponent',
    data() {
        return {
            query: '',
            filter: 'hotness',
            categoryFilter: '', // 新增分类筛选变量
            allRecommendations: [], // 存储所有数据
            filteredRecommendations: [],
            loading: true, // 初始设为加载状态
            currentPage: 1,
            itemsPerPage: 15,
            error: null,
            selectedItem: null,
            currentRating: 0,
            hoverRating: 0,
            hasRated: false,
            categories: [
                '水', '水库', '景点', '建筑', '停车', '住宅', '商业区', '服务设施', '排水系统', '主城区',
                '体育场', '公园', '大使馆', '大学', '自然保护区', '军事区', '学校', '体育中心', '社区中心', '墓地',
                '机场', '医院', '河岸', '岛屿', '森林', '城堡', '工业区', '高速公路', '行人', '铁路',
                '零售', '自行车道', '草地', '高尔夫球场', '监狱', '农家庭院', '艺术馆', '场地', '废墟', '动物园',
                '学院', '幼儿园', '主题公园', '运河', '地铁', '佛教', '纪念碑', '人行道', '台阶', '国家首都',
                '河流', '小路', '考古区', '干线连接', '次要连接', '溪流', '马道', '生活街道', '酒店', '交通信号灯',
                '穆斯林的', '博物馆', '公交站', '湿地', '市场', '小径', '污水处理厂', '农田', '纪念馆', '高速公路连接',
                '第三级连接', '主要连接', '游泳池', '公交总站', '火车站', '招待所', '便利设施', '游乐场', '喷泉', '观景台',
                '警察', '购物中心', '道教的', '燃料', '邮局', '海滩', '城市', '城镇', '塔楼', '码头',
                '餐厅', '小村庄', '山峰', '地点', '快餐', '村庄', '咖啡馆', '露营地', '户外用品店', '战场',
                '美发店', '十字路口', '消防站', '采石场', '水坝', '单轨铁路', '基督教', '轻轨', '艺术中心', '果园',
                '自来水厂', '牙医诊所', '图书馆', '郊区', '铁路小站', '有轨电车', '汽车经销商', '缆车', '游客信息中心', '树',
                '超市', '诊所', '法院', '剧院', '宾馆', '电影院', '药店', '泉', '面包店', '灌木',
                '饮品', '洗衣店', '自动取款机', '书店', '市政厅', '百货商店', '银行', '文具店', '眼镜店', '养老院',
                '基督教新教', '溜冰场', '直升机起降坪', '厕所', '汽车租赁', '葡萄园', '微型铁路', '珠宝店', '洞穴入口', '堡垒',
                '回收', '美食广场', '服装', '自行车停车处', '洗车场', '电车站', '礼品店', '蔬菜水果店', '庇护所', '兽医诊所',
                '酒吧', '美容店', '悬崖'
            ],
            isInitialLoad: true, // 标记是否为初始加载
            totalItems: 0, // 总数据量
            fakeTotalPages: 5 // 初始加载时假的总页数
        };
    },
    computed: {
        uniqueCategories() {
            // 去重并排序分类
            return [...new Set(this.categories)].sort();
        },
        totalPages() {
            // 初始加载时返回假的总页数，否则返回真实计算的总页数
            if (this.isInitialLoad) {
                return this.fakeTotalPages;
            }
            return Math.ceil(this.filteredRecommendations.length / this.itemsPerPage);
        },
        currentRecommendations() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = this.currentPage * this.itemsPerPage;
            return this.filteredRecommendations.slice(start, end);
        },
        visiblePageNumbers() {
            const totalPages = this.totalPages;
            const pageNumbers = [];
            const range = 2;
            let startPage = Math.max(this.currentPage - range, 1);
            let endPage = Math.min(this.currentPage + range, totalPages);

            // 初始加载时特殊处理页码显示
            if (this.isInitialLoad) {
                if (this.currentPage <= 3) {
                    endPage = Math.min(5, totalPages);
                } else if (this.currentPage > 3 && this.currentPage < totalPages) {
                    startPage = totalPages - 4;
                    endPage = totalPages;
                } else {
                    startPage = totalPages - 4;
                    endPage = totalPages;
                }
            } else {
                // 非初始加载时的正常页码计算
                if (this.currentPage <= range) {
                    endPage = Math.min(5, totalPages);
                }
                if (this.currentPage >= totalPages - range) {
                    startPage = Math.max(totalPages - 4, 1);
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                pageNumbers.push(i);
            }

            return pageNumbers;
        }
    },
    methods: {
        async setRating(score) {
            this.currentRating = score;  // 用户选择的评分立即显示

            if (this.selectedItem.hasRated) {
                alert('您已经评过分了');
                return;
            }

            try {
                // 向后端发送评分请求
                const response = await axios.post(`http://localhost:3000/api/rate/${this.selectedItem.osm_id}`, { score });

                // 如果评分成功，更新 selectedItem 的评分信息
                if (response.data.success) {
                    // 创建更新后的景点对象
                    const updatedItem = {
                        ...this.selectedItem,
                        rating: response.data.newRating,  // 更新评分
                        rating_count: response.data.newRatingCount,  // 更新评分人数
                        popularity: response.data.newPopularity,  // 更新热度
                        hasRated: true  // 标记用户已经评分
                    };

                    this.selectedItem = updatedItem;

                    // 查找并更新 filteredRecommendations 中的对应项
                    if (Array.isArray(this.filteredRecommendations)) {
                        const index = this.filteredRecommendations.findIndex(
                            item => item.osm_id === updatedItem.osm_id
                        );
                        if (index !== -1) {
                            // 使用 Vue.set 确保数组变化被检测到
                            this.filteredRecommendations[index] = updatedItem;
                        }
                    }
                }

            } catch (error) {
                console.error('评分失败:', error);
                this.error = '评分失败，请稍后重试';
            }
        },

        async onSearch() {
            this.loading = true;
            this.error = null;

            try {
                const response = await axios.get('http://localhost:3000/api/recommendations', {
                    params: {
                        filter: this.filter,
                        query: this.query,
                        category: this.categoryFilter,
                        isInitial: this.isInitialLoad,
                        page: this.currentPage
                    }
                });

                console.log('响应数据类型:', typeof response.data, '是否数组:', Array.isArray(response.data));

                let results = [];
                let total = 0;

                // 处理不同的返回格式
                if (Array.isArray(response.data)) {
                    // 如果后端直接返回数组
                    results = response.data;
                    total = response.data.length;
                } else {
                    // 如果后端返回对象 { results: [...], total: ... }
                    results = response.data.results || [];
                    total = response.data.total || results.length;
                }

                this.filteredRecommendations = results.map(item => ({
                    name: item.name,
                    popularity: item.popularity,
                    fclass: item.fclass,
                    cover: item.cover || '/path/to/default/image.jpg',
                    osm_id: item.osm_id,
                    views: item.views,
                    rating: item.rating || 0,
                    rating_count: item.rating_count || 0,
                    description: item.description || '暂无简介',
                }));

                this.totalItems = total;
                console.log('总数据量:', this.totalItems);

                this.loading = false;
            } catch (err) {
                this.error = '数据加载失败，请重试';
                console.error('请求错误:', err);
                this.loading = false;
            }
        },
        onCardClick(item) {
            this.selectedItem = item;
            this.currentRating = 0;  // 重置评分星级
            this.hasRated = false;   // 重置评分标志

            axios.post(`http://localhost:3000/api/increase-view/${item.osm_id}`)
                .then(response => {
                    this.selectedItem.popularity = response.data.newPopularity;  // 更新热度
                    this.selectedItem.views = response.data.newViews;  // 更新访问量
                })
                .catch(console.error);
        },

        closeModal() {
            this.selectedItem = null;
        },

        openModal() {
            this.selectedItem = { ...this.selectedItem }; // 确保selectedItem有更新的内容
        },

        changePage(page) {
            if (page < 1 || page > this.totalPages) return;

            // 初始加载时点击2-5页跳转
            if (this.isInitialLoad && page >= 2 && page <= 5) {
                this.$router.push({
                    path: '/Ne',
                    query: {  // 传递需要的参数
                        page,
                        filter: this.filter,
                        query: this.query,
                        category: this.categoryFilter
                    }
                });
                return;
            }

            // 正常分页逻辑
            if (page > 1 && this.isInitialLoad) {
                this.isInitialLoad = false;
            }

            this.currentPage = page;
            this.onSearch();
        }
    },
    mounted() {
        this.onSearch();
    }
};
</script>


<style scoped>
/* 整体容器，确保背景覆盖全屏并保持边距 */
.container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 20px;
}

.search-button {
    padding: 10px 20px;
    border-radius: 20px;
    background-color: #f60;
    color: white;
    border: none;
    font-size: 14px;
    cursor: pointer;
}

/* 搜索栏样式，固定在顶部 */
.search-bar {
    position: sticky;
    top: 0;
    background-color: #fff;
    padding: 10px 20px;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-radius: 20px;
    display: flex;
    justify-content: center;
    /* 水平居中 */
    align-items: center;
    /* 垂直居中 */
    gap: 10px;
    /* 调整元素间间隔 */
}

.search-input {
    flex: 1;
    max-width: 40%;
    padding: 10px;
    border-radius: 20px;
    border: 1px solid #ddd;
    font-size: 14px;
}

.category-select,
.filter-select {
    padding: 10px;
    border-radius: 20px;
    border: 1px solid #ddd;
    background-color: #fff;
    font-size: 14px;
    min-width: 120px;
}

/* 推荐部分 */
.recommendation {
    flex-grow: 1;
    margin-top: 20px;
    padding: 0 20px;
    background-color: #fff;
    border-radius: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 推荐列表的布局 */
.recommendation-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
}

/* 推荐卡片 */
.recommendation-card {
    background-color: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    text-align: center;
    transition: transform 0.3s ease;
}

.recommendation-card:hover {
    transform: scale(1.05);
}

.cover-img-wrapper {
    height: 150px;
    overflow: hidden;
}

.cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

h3 {
    font-size: 16px;
    margin: 10px 0;
}

.description {
    font-size: 14px;
    color: #666;
}

.popularity {
    font-size: 14px;
    color: #f60;
}

.category {
    font-size: 13px;
    color: #999;
    margin: 5px 0;
}

/* 分页样式 */
.pagination {
    display: flex;
    justify-content: center;
    margin-top: 20px;
    align-items: center;
}

.pagination button {
    padding: 10px;
    margin: 0 5px;
    border: 1px solid #ddd;
    background-color: #fff;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
}

.pagination button:disabled {
    cursor: not-allowed;
    background-color: #f5f5f5;
}

.pagination button.active {
    background-color: #f60;
    color: white;
}

.pagination span {
    margin: 0 5px;
    font-size: 14px;
    color: #666;
}

/* 放大卡片视图样式 */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(0, 0, 0, 0.7);
    z-index: 100;
}

.modal-content {
    width: 30vw;
    /* 视口宽度的30% */
    max-width: 450px;
    /* 最大宽度限制 */
    height: 85vh;
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal-img-container {
    height: 220px;
    /* 固定高度 */
    position: relative;
    overflow: hidden;
    border-bottom: 2px solid #eee;
}

.modal-img {
    width: 100%;
    height: auto;
    /* 高度自适应 */
    max-height: 220px;
    object-fit: contain;
    /* 完整显示图片 */
}

.modal-scroll-content {
    flex: 1;
    padding: 15px;
    overflow-y: auto;
}

.info-section {
    margin: 15px 0;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
}

.rating-section {
    margin-top: 20px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
}

.stars {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 10px;
}

.star {
    cursor: pointer;
    font-size: 24px;
    color: #e0e0e0;
    transition: all 0.2s;
}

.star.active {
    color: #ffc107;
}

.star.hover {
    color: #ffd700;
}

.description-section {
    margin-top: 20px;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 8px;
}

.rating-info {
    text-align: center;
    color: #666;
    font-size: 0.9em;
}

/* 加载状态样式 */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 50px 0;
}

.loader {
    width: 48px;
    height: 48px;
    border: 5px solid #f60;
    border-bottom-color: transparent;
    border-radius: 50%;
    animation: rotation 1s linear infinite;
    margin-bottom: 15px;
}

@keyframes rotation {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.error-state {
    text-align: center;
    padding: 50px 0;
    color: #e74c3c;
}

.error-state button {
    margin-top: 15px;
    padding: 8px 20px;
    background-color: #f60;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
</style>