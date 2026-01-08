<template>
  <div>
    <div id="map"></div>
    <div class="search-container" :class="{ collapsed: isCollapsed }" id="search-container">
      <div class="search-container-header" id="search-header" @click="togglePanel">
        <h3>导航控制面板</h3>
        <button class="toggle-collapse" id="toggle-collapse">{{ isCollapsed ? '+' : '−' }}</button>
      </div>
      <div class="collapsible-content" v-if="!isCollapsed">
        <input type="text" id="start" placeholder="出发地（当前位置）" disabled :value="currentLocationText" />
        <input type="text" id="search-destination" placeholder="搜索目的地..." v-model="searchQuery" @input="handleSearchInput" />
        
        <!-- 景点设施搜索框（完整修改版本） -->
        <div class="attraction-facility-search">
          <h4>景点设施搜索</h4>
          <input 
            type="text" 
            id="attraction-search" 
            placeholder="输入景点名称" 
            v-model="attractionQuery" 
            @keyup.enter="searchFacilities"
          />
          
          <!-- 新增：服务设施关键词搜索框 + 开始搜索按钮 -->
          <div class="custom-search-group">
            <input 
              type="text" 
              id="facility-keyword" 
              placeholder="输入服务设施关键词（如餐厅、厕所）" 
              v-model="facilityKeyword" 
              class="facility-search-input"
            />
            <button 
              class="search-facility-btn"
              @click="searchFacilities"
            >
              开始搜索
            </button>
          </div>
        </div>

        <!-- 搜索结果列表 -->
        <div class="search-results" id="search-results" v-show="searchResults.length > 0">
          <div class="search-result-item" v-for="(result, index) in searchResults" :key="index" @click="addDestination(result)">
            {{ result.name }} - 距离: {{ result.distance.toFixed(2) }} km
          </div>
        </div>

        <!-- 附近设施列表 -->
        <div class="nearby-poi-list" v-if="showFacilityList && facilityList.length > 0">
          <div class="poi-list-header">
            <h4>附近设施 ({{ attractionQuery }})</h4>
            <button class="close-poi-list" @click="closeFacilityList">×</button>
          </div>
          <div class="poi-list-items">
            <div class="poi-list-item" v-for="(poi, index) in facilityList" :key="index" @click="navigateToFacility(poi)">
              <span>{{ poi.name }}</span>
              <span class="poi-distance">{{ poi.distance.toFixed(2) }} km</span>
            </div>
          </div>
        </div>

        <div class="selected-destinations" id="selected-destinations">
          <div class="selected-destination" v-for="(dest, index) in selectedDestinations" :key="index">
            <span>{{ getTransportIcon(dest.transportMode) }} {{ dest.name }}</span>
          </div>
        </div>
        
        <div class="transport-mode">
          <label>当前交通方式:</label>
          <div class="transport-options">
            <div class="transport-option" 
                 :class="{ selected: currentTransportMode === 'walk' }" 
                 data-mode="walk"
                 @click="currentTransportMode = 'walk'">步行 🚶</div>
            <div class="transport-option" 
                 :class="{ selected: currentTransportMode === 'bike' }" 
                 data-mode="bike"
                 @click="currentTransportMode = 'bike'">自行车 🚲</div>
            <div class="transport-option" 
                 :class="{ selected: currentTransportMode === 'escooter' }" 
                 data-mode="escooter"
                 @click="currentTransportMode = 'escooter'">电瓶车 🛵</div>
          </div>
        </div>
        
        <div class="toggle-container">
          <span class="toggle-label">最短距离</span>
          <label class="toggle-switch">
            <input type="checkbox" v-model="considerCongestion">
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">考虑拥挤度</span>
        </div>
        
        <div class="path-info" id="path-info" v-html="pathInfo"></div>
        <button id="navigate" @click="planPath">开始导航</button>
        <button id="clear" @click="clearAll">清除路径</button>
      </div>
    </div>
  </div>
</template>

<script>
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default {
  name: 'PathPlanner',
  data() {
    return {
      map: null,
      startMarker: null,
      routeLines: [],
      destinationMarkers: [],
      startLatLng: null,
      pointsData: null,
      linesData: null,
      selectedDestinations: [],
      graph: null,
      congestionData: {},
      currentTransportMode: 'walk',
      isCollapsed: false,
      searchQuery: '',
      searchResults: [],
      considerCongestion: false,
      pathInfo: '',
      currentLocationText: '',
      attractionQuery: '',
      selectedCategory: '',
      showFacilityList: false,
      facilityList: [],
      facilityKeyword: '', 
      showDestinationMarkers: false,
      returnToStart: true 
    };
  },
  async mounted() {
    await this.setupNavigation();
  },
  methods: {
        // 添加归并排序方法
    mergeSort(arr, compareFn = (a, b) => a.distance - b.distance) {
      const copy = [...arr];
      return this.sort(copy, compareFn);
    },
    
    sort(arr, compareFn) {
      const len = arr.length;
      if (len <= 1) return arr;
      const mid = Math.floor(len / 2);
      const left = this.sort(arr.slice(0, mid), compareFn);
      const right = this.sort(arr.slice(mid), compareFn);
      return this.merge(left, right, compareFn);
    },
    
    merge(left, right, compareFn) {
      const result = [];
      let leftIndex = 0, rightIndex = 0;
      while (leftIndex < left.length && rightIndex < right.length) {
        if (compareFn(left[leftIndex], right[rightIndex]) <= 0) {
          result.push(left[leftIndex++]);
        } else {
          result.push(right[rightIndex++]);
        }
      }
      return [...result, ...left.slice(leftIndex), ...right.slice(rightIndex)];
    },

    togglePanel() {
      this.isCollapsed = !this.isCollapsed;
      if (this.map) {
        setTimeout(() => {
          this.map.invalidateSize();
        }, 300);
      }
    },
    
    async getCurrentLocation() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject("浏览器不支持定位功能");
        } else {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const lat = position.coords.latitude;
              const lng = position.coords.longitude;
              this.startLatLng = L.latLng(lat, lng);
              resolve(this.startLatLng);
            },
            (error) => {
              reject("无法获取当前位置: " + error.message);
            }
          );
        }
      });
    },

    async loadPointsData() {
      try {
        const response = await fetch('newpoint.geojson');
        this.pointsData = await response.json();
      } catch (error) {
        console.error('加载POI数据失败:', error);
      }
    },

    async loadLinesData() {
      try {
        const response = await fetch('OsmFile_lines.geojson');
        this.linesData = await response.json();
      } catch (error) {
        console.error('加载线路数据失败:', error);
      }
    },

    getCongestionByTransport(highwayType, transportMode) {
      if (transportMode === 'walk') {
        if (highwayType === 'footway') return 0.9;
        if (highwayType === 'pedestrian') return 0.85;
        if (highwayType === 'service') return 0.8;
        if (highwayType === 'tertiary' || highwayType === 'residential') return 0.8;
        return 0.7;
      } 
      else if (transportMode === 'bike') {
        if (highwayType === 'pedestrian') return 0.85 * 1.2;
        if (highwayType === 'service') return 0.8 * 1.2;
        if (highwayType === 'tertiary' || highwayType === 'residential') return 0.8 * 1.2;
        return null;
      } 
      else if (transportMode === 'escooter') {
        if (highwayType === 'secondary') return 0.65 * 1.3;
        if (['motorway', 'trunk', 'primary', 'secondary_link', 'tertiary', 'residential'].includes(highwayType)) {
          return 0.5 * 1.3;
        }
        return null;
      }
      
      return 0.7;
    },

    initCongestionData() {
      this.congestionData = {};
      
      if (!this.linesData || !this.linesData.features) return;
      
      this.linesData.features.forEach(feature => {
        const highwayType = feature.properties.highway;
        if (!highwayType) return;
        
        const coordinates = feature.geometry.coordinates;
        for (let i = 0; i < coordinates.length - 1; i++) {
          const point1 = coordinates[i];
          const point2 = coordinates[i + 1];
          const key1 = `${point1[1]},${point1[0]}`;
          const key2 = `${point2[1]},${point2[0]}`;
          
          this.congestionData[`${key1}-${key2}`] = {
            walk: this.getCongestionByTransport(highwayType, 'walk'),
            bike: this.getCongestionByTransport(highwayType, 'bike'),
            escooter: this.getCongestionByTransport(highwayType, 'escooter')
          };
          this.congestionData[`${key2}-${key1}`] = {
            walk: this.getCongestionByTransport(highwayType, 'walk'),
            bike: this.getCongestionByTransport(highwayType, 'bike'),
            escooter: this.getCongestionByTransport(highwayType, 'escooter')
          };
        }
      });
    },

    canUseRoad(highwayType, transportMode) {
      if (!highwayType) return false;
      
      switch(transportMode) {
        case 'walk':
          return true;
        case 'bike':
          return ['pedestrian', 'service', 'tertiary', 'residential'].includes(highwayType);
        case 'escooter':
          return ['secondary', 'motorway', 'trunk', 'primary', 'secondary_link', 'tertiary', 'residential'].includes(highwayType);
        default:
          return false;
      }
    },

    buildGraph(linesData) {
      const graph = {};
      
      if (!linesData || !linesData.features) return graph;
      
      linesData.features.forEach(feature => {
        const coordinates = feature.geometry.coordinates;
        const highwayType = feature.properties.highway;
        if (!highwayType) return;
        
        for (let i = 0; i < coordinates.length - 1; i++) {
          const point1 = coordinates[i];
          const point2 = coordinates[i + 1];
          const key1 = `${point1[1]},${point1[0]}`;
          const key2 = `${point2[1]},${point2[0]}`;

          if (!graph[key1]) graph[key1] = [];
          if (!graph[key2]) graph[key2] = [];

          const dx = point2[0] - point1[0];
          const dy = point2[1] - point1[1];
          let distance = Math.sqrt(dx * dx + dy * dy);

          graph[key1].push({ 
            node: key2, 
            distance,
            highwayType,
            originalDistance: distance
          });
          graph[key2].push({ 
            node: key1, 
            distance,
            highwayType,
            originalDistance: distance
          });
        }
      });
      
      return graph;
    },

    searchDestinations(query) {
      if (!this.pointsData || !query) return [];
      const results = [];
      const lowerQuery = query.toLowerCase();
      const startLatLng = this.startLatLng || L.latLng(39.9049, 116.4074);
      
      this.pointsData.features.forEach((feature, index) => {
        const name = feature.properties.name || `目的地 ${index + 1}`;
        if (name.toLowerCase().includes(lowerQuery)) {
          const coords = feature.geometry.coordinates;
          const destLatLng = L.latLng(coords[1], coords[0]);
          const distance = this.calculateDistance(startLatLng, destLatLng);
          results.push({ index, name, coords, distance });
        }
      });

      // 替换为归并排序
      const sortedResults = this.mergeSort(results).slice(0, 10);
      return sortedResults;
    },

    calculateDistance(latLng1, latLng2) {
      const R = 6371e3;
      const φ1 = latLng1.lat * Math.PI / 180;
      const φ2 = latLng2.lat * Math.PI / 180;
      const Δφ = (latLng2.lat - latLng1.lat) * Math.PI / 180;
      const Δλ = (latLng2.lng - latLng1.lng) * Math.PI / 180;

      const a = 
        Math.sin(Δφ/2) * Math.sin(Δφ/2) +
        Math.cos(φ1) * Math.cos(φ2) * 
        Math.sin(Δλ/2) * Math.sin(Δλ/2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c / 1000;
    },

    handleSearchInput() {
      if (this.searchQuery.length < 2) {
        this.searchResults = [];
        return;
      }
      
      this.searchResults = this.searchDestinations(this.searchQuery);
    },

    addDestination(result) {
      this.selectedDestinations.push({
        index: result.index,
        name: result.name,
        coords: [result.coords[1], result.coords[0]],
        transportMode: this.currentTransportMode,
        order: this.selectedDestinations.length + 1 // 添加序号标识
      });
      this.searchResults = [];
      this.searchQuery = '';
    },

    getTransportIcon(mode) {
      switch(mode) {
        case 'walk': return '🚶';
        case 'bike': return '🚲';
        case 'escooter': return '🛵';
        default: return '';
      }
    },

    createPoiMarker(latLng) {
      const marker = L.marker(latLng, {
        icon: L.divIcon({
          className: 'poi-marker',
          html: `<div class="marker-pin poi"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 20]
        }),
        interactive: true
      });

      return marker;
    },

    clearMap() {
      if (!this.map) return;
      
      // 移除路径线条
      this.routeLines.forEach(line => {
        if (this.map.hasLayer(line)) {
          this.map.removeLayer(line);
        }
      });
      this.routeLines = [];
      
      this.destinationMarkers = [];
      this.showDestinationMarkers = false;
      
      // 重置起点标记
      this.startMarker = null;
    },

    clearAll() {
      // 原逻辑：清除地图内容和选中目的地
      this.clearMap();
      this.selectedDestinations = [];
      this.pathInfo = '';
      this.closeFacilityList();
      
      // **新增**：刷新页面（注意：会导致浏览器重新加载当前页面）
      window.location.reload(); // 触发页面重载，等同于手动刷新
    },

    findNearestNode(graph, latLng, transportMode) {
      if (!graph || !latLng) return null;
      
      const [lat, lng] = [latLng.lat, latLng.lng];
      let nearestNode = null;
      let minDistance = Infinity;

      for (const node of Object.keys(graph)) {
        const hasValidEdge = graph[node].some(edge => 
          this.canUseRoad(edge.highwayType, transportMode));
        
        if (!hasValidEdge) continue;
        
        const [nodeLat, nodeLng] = node.split(',').map(Number);
        const dx = nodeLng - lng;
        const dy = nodeLat - lat;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          nearestNode = node;
        }
      }

      return nearestNode;
    },

    calculateEffectiveDistance(edge, transportMode, considerCongestion) {
      if (!this.canUseRoad(edge.highwayType, transportMode)) {
        return Infinity;
      }
      
      let distance = edge.originalDistance;
      
      if (considerCongestion) {
        const congestion = this.getCongestionByTransport(edge.highwayType, transportMode);
        if (congestion === null) return Infinity;
        distance = distance / congestion;
      }
      
      return distance;
    },

    drawPathOnMap(pathSegments) {
      if (!this.map) return;
      
      this.clearMap();
      
      pathSegments.forEach(segment => {
        const pathCoords = segment.nodes.map(node => {
          const [lat, lng] = node.split(',').map(Number);
          return [lat, lng];
        });
        
        let color;
        if (segment.isReturnPath) {
          color = 'purple'; // 返回路径使用紫色
        } else {
          switch(segment.transport) {
            case 'walk': color = 'blue'; break;
            case 'bike': color = 'green'; break;
            case 'escooter': color = 'orange'; break;
            default: color = 'blue';
          }
        }
        
        const line = L.polyline(pathCoords, { 
          color,
          weight: 5,
          dashArray: segment.isReturnPath ? '5, 5' : null // 返回路径使用虚线
        }).addTo(this.map);
        
        this.routeLines.push(line);
      });
      
      if (pathSegments.length > 0) {
        const bounds = L.latLngBounds(
          pathSegments.flatMap(segment => 
            segment.nodes.map(node => {
              const [lat, lng] = node.split(',').map(Number);
              return [lat, lng];
            })
        ));
        this.map.fitBounds(bounds);
      }
    },

    calculatePathDistance(path, graph) {
      if (!path || !graph) return 0;
      
      let distance = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const node1 = path[i];
        const node2 = path[i+1];
        const neighbor = graph[node1]?.find(n => n.node === node2);
        if (neighbor) distance += neighbor.originalDistance;
      }
      return distance;
    },

    displayPathInfo(segments, graph) {
      if (!segments || !graph) {
        this.pathInfo = '<p>暂无路径信息</p>';
        return;
      }
      
      let totalTime = 0;
      let totalReturnTime = 0;
      let html = '<p><strong>路径分段信息:</strong></p>';
      
      segments.forEach((segment, index) => {
        const distance = this.calculatePathDistance(segment.nodes, graph);
        let timeMinutes = 0;
        
        // 根据交通方式计算时间
        switch(segment.transport) {
          case 'walk':
            timeMinutes = (distance * 1000) / 10;
            break;
          case 'bike':
            timeMinutes = (distance * 1000) / 20;
            break;
          case 'escooter':
            timeMinutes = (distance * 1000) / 30;
            break;
          default:
            timeMinutes = (distance * 1000) / 10; // 默认步行速度
        }
        
        // 考虑拥挤度的影响
       if (this.considerCongestion) {
         timeMinutes *= 1.3; 
        }
        totalTime += timeMinutes;
        
        if (segment.isReturnPath) {
          totalReturnTime = timeMinutes;
        }
        
        const transportName = segment.isReturnPath ? 
          '返回起点' : 
          {
            'walk': '步行 🚶',
            'bike': '自行车 🚲',
            'escooter': '电瓶车 🛵'
          }[segment.transport] || '步行';
        
        html += `
          <div class="segment-info" style="${segment.isReturnPath ? 'color:purple;font-weight:bold;' : ''}">
            <strong>段 ${index + 1}:</strong>
            ${transportName} - ${timeMinutes.toFixed(1)} 小时
          </div>
        `;
      });
      
      html += `
        <p><strong>总时间:</strong> ${totalTime.toFixed(1)} 小时</p>
        ${totalReturnTime > 0 ? 
          `<p><strong>返回时间:</strong> ${totalReturnTime.toFixed(1)} 小时</p>` : ''}
      `;
      this.pathInfo = html;
    },
    // 修改 getNearbyPois 中的排序逻辑
    getNearbyPois(latLng) {
      if (!this.pointsData) return [];
      const results = [];
      this.pointsData.features.forEach(feature => {
        const name = feature.properties.name;
        if (!name) return;
        const poiCoords = feature.geometry.coordinates;
        const poiLatLng = L.latLng(poiCoords[1], poiCoords[0]);
        if (Math.abs(poiLatLng.lat - latLng.lat) < 0.0001 && 
            Math.abs(poiLatLng.lng - latLng.lng) < 0.0001) {
          return;
        }
        const distance = this.calculateDistance(latLng, poiLatLng);
        results.push({ name, coords: poiCoords, distance });
      });

      // 替换为归并排序
      return this.mergeSort(results);
    },

    selectCategory(category) {
      this.selectedCategory = category;
      if (this.attractionQuery.trim()) {
        this.searchFacilities();
      }
    },
    searchFacilities() {
      if (!this.attractionQuery.trim()) return;

      // 查找目标景点
      const targetPoi = this.pointsData.features.find(
        poi => poi.properties.name && 
        poi.properties.name.toLowerCase().includes(this.attractionQuery.toLowerCase())
      );

      if (!targetPoi) {
        alert(`未找到名为 "${this.attractionQuery}" 的景点`);
        this.facilityList = [];
        this.showFacilityList = false;
        return;
      }

      const targetLatLng = L.latLng(targetPoi.geometry.coordinates[1], targetPoi.geometry.coordinates[0]);
      const allPois = this.getNearbyPois(targetLatLng);

      // **核心修改：先筛选包含"服务设施"的POI，再应用关键词过滤**
      const keyword = this.facilityKeyword.toLowerCase();
      this.facilityList = allPois
        // 第一步：筛选名称包含"服务设施"的POI
        .filter(poi => poi.name.toLowerCase().includes('服务设施'))
        // 第二步：在上述结果中过滤用户输入的关键词（支持部分匹配）
        .filter(poi => !keyword || poi.name.toLowerCase().includes(keyword))
        .slice(0, 10); // 限制最多10条结果

      this.showFacilityList = this.facilityList.length > 0;
      this.map.setView(targetLatLng, 15);

      // 清除旧标记（避免重复添加）
      this.destinationMarkers.forEach(marker => {
        if (this.map.hasLayer(marker)) {
          this.map.removeLayer(marker);
        }
      });
      this.destinationMarkers = []; // 重置标记数组

      // 添加新标记
      this.facilityList.forEach(poi => {
        const marker = this.createPoiMarker(
          L.latLng(poi.coords[1], poi.coords[0]), 
          poi.name
        );
        marker.addTo(this.map);
        this.destinationMarkers.push(marker);
      });
    },
    

    closeFacilityList() {
      this.showFacilityList = false;
      this.attractionQuery = '';
      this.selectedCategory = '';
    },

    navigateToFacility(poi) {
      this.addDestination({
        name: poi.name,
        coords: poi.coords,
        distance: poi.distance
      });
            // 导航时生成带序号的目的地图标（保持原有逻辑）
      this.addDestination({
        name: poi.name,
        coords: poi.coords,
        distance: poi.distance
      });
      
      // 清除之前的POI标记（避免重复）
      this.map.eachLayer(layer => {
        if (layer.options.icon?.className?.includes('poi-marker')) {
          this.map.removeLayer(layer);
        }
      });
      this.closeFacilityList();
    },

    async planPath() {
      if (!this.map || !this.startLatLng || this.selectedDestinations.length === 0) {
        console.warn('地图未初始化或未选择目的地');
        return;
      }
      
      try {
        this.clearMap();
        this.showDestinationMarkers = true;
        this.returnPath = null; // 重置返回路径
        
        const fullGraph = this.buildGraph(this.linesData);
        
        const firstTransportMode = this.selectedDestinations[0].transportMode;
        const startNode = this.findNearestNode(fullGraph, this.startLatLng, firstTransportMode);
        
        if (!startNode) {
          throw new Error('无法找到起点的有效路径节点');
        }
        
        const destinationsWithNodes = await Promise.all(
          this.selectedDestinations.map(async dest => {
            const destLatLng = L.latLng(dest.coords[0], dest.coords[1]);
            const node = this.findNearestNode(
              fullGraph,
              destLatLng,
              dest.transportMode
            );
            
            if (!node) {
              throw new Error(`无法找到目的地 ${dest.name} 的有效路径节点`);
            }

            return { 
              ...dest, 
              node 
            };
          })
        );
        
        let currentPosition = startNode;
        let allPathSegments = [];
        let visitedOrder = [];

        // 创建起点标记
        if (!this.startMarker) {
          const startMarkerIcon = L.divIcon({
            className: 'start-marker',
            html: `<div class="marker-pin start">
                    <span class="marker-text">起</span>
                  </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30]
          });
          
          this.startMarker = L.marker(this.startLatLng, { 
            icon: startMarkerIcon,
            interactive: false
          }).addTo(this.map);
        }

        // 导航到所有目的地
        for (const dest of destinationsWithNodes) {
          const astar = new AStar(
            fullGraph, 
            currentPosition, 
            dest.node, 
            dest.transportMode, 
            this.considerCongestion,
            this
          );
          
          const pathResult = astar.findPath();
          
          if (!pathResult.nodes.length) {
            throw new Error(`无法找到到 ${dest.name} 的路径`);
          }

          allPathSegments.push({
            nodes: pathResult.nodes,
            transport: dest.transportMode,
            isReturnPath: false
          });
          
          visitedOrder.push(dest);
          currentPosition = dest.node;

          // 创建简化的目的地图标（仅显示数字）
          const destMarker = L.marker([dest.coords[0], dest.coords[1]], {
            icon: L.divIcon({
              className: 'destination-marker',
              html: `<div class="marker-number">${dest.order}</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 30]
            }),
            interactive: false
          }).addTo(this.map);
          
          this.destinationMarkers.push(destMarker);
        }

        // 自动从最后一个目的地返回起点
        if (this.returnToStart) {
          const returnAstar = new AStar(
            fullGraph,
            currentPosition,
            startNode,
            this.currentTransportMode,
            this.considerCongestion,
            this
          );
          
          const returnPathResult = returnAstar.findPath();
          
          if (returnPathResult.nodes.length) {
            this.returnPath = {
              nodes: returnPathResult.nodes,
              transport: this.currentTransportMode,
              isReturnPath: true
            };
            
            allPathSegments.push(this.returnPath);
            
            // 添加返回起点的标记
            const returnMarker = L.marker([this.startLatLng.lat, this.startLatLng.lng], {
              icon: L.divIcon({
                className: 'return-marker',
                html: `<div class="marker-pin return">
                        <span>起点</span>
                      </div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 30]
              }),
              interactive: false
            }).addTo(this.map);
            
            this.destinationMarkers.push(returnMarker);
          }
        }

        this.drawPathOnMap(allPathSegments);
        this.displayPathInfo(allPathSegments, fullGraph);

      } catch (error) {
        console.error('路径规划错误:', error);
        alert('路径规划失败: ' + error.message);
      }
    },

    async setupNavigation() {
      try {
        this.map = L.map('map').setView([39.9049, 116.4074], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
        
        const start = await this.getCurrentLocation();
        this.currentLocationText = `纬度: ${start.lat.toFixed(4)}, 经度: ${start.lng.toFixed(4)}`;
        
        await this.loadPointsData();
        await this.loadLinesData();
        this.initCongestionData();
        
      } catch (error) {
        console.error("初始化失败:", error);
        alert("初始化失败: " + error.message);
      }
    }
  }
};

class AStar {
  constructor(graph, start, end, transportMode, considerCongestion, vm) {
    this.graph = graph;
    this.start = start;
    this.end = end;
    this.transportMode = transportMode;
    this.considerCongestion = considerCongestion;
    this.vm = vm;
    this.openList = [];
    this.closedList = new Set();
    this.cameFrom = {};
    this.gScore = {};
    this.fScore = {};
    this.usedTransport = {};
  }

  heuristic(node) {
    const [lat1, lng1] = node.split(',').map(Number);
    const [lat2, lng2] = this.end.split(',').map(Number);
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
  }

  findPath() {
    this.openList.push(this.start);
    this.gScore[this.start] = 0;
    this.fScore[this.start] = this.heuristic(this.start);
    this.usedTransport[this.start] = this.transportMode;

    while (this.openList.length > 0) {
      let current = this.openList.reduce((lowest, node) => {
        return this.fScore[node] < this.fScore[lowest] ? node : lowest;
      }, this.openList[0]);

      if (current === this.end) {
        return this.reconstructPath(current);
      }

      this.openList = this.openList.filter(node => node !== current);
      this.closedList.add(current);

      const neighbors = this.graph[current] || [];
      for (let neighborEdge of neighbors) {
        const neighborNode = neighborEdge.node;
        if (this.closedList.has(neighborNode)) continue;

        const effectiveDistance = this.vm.calculateEffectiveDistance(
          neighborEdge, 
          this.transportMode, 
          this.considerCongestion
        );
        
        if (effectiveDistance === Infinity) continue;

        const tentativeGScore = this.gScore[current] + effectiveDistance;
        
        if (!this.openList.includes(neighborNode)) {
          this.openList.push(neighborNode);
        } else if (tentativeGScore >= this.gScore[neighborNode]) {
          continue;
        }

        this.cameFrom[neighborNode] = current;
        this.gScore[neighborNode] = tentativeGScore;
        this.fScore[neighborNode] = tentativeGScore + this.heuristic(neighborNode);
        this.usedTransport[neighborNode] = this.transportMode;
      }
    }

    return { nodes: [], transports: [] };
  }

  reconstructPath(current) {
    let path = [];
    let transports = [];
    let temp = current;
    
    while (temp !== this.start) {
      path.push(temp);
      transports.push(this.usedTransport[temp] || this.transportMode);
      temp = this.cameFrom[temp];
    }
    
    path.push(this.start);
    transports.push(this.transportMode);
    
    return {
      nodes: path.reverse(),
      transports: transports.reverse()
    };
  }
}
</script>

<style>
/* 地图容器 */
#map {
  height: 100vh;
  width: 100vw;
  position: fixed;
  top: 0;
  left: 0;
  /* 裁剪出矩形区域：从左侧180px开始，高度100vh */
  clip-path: polygon(
    180px 0,             /* 左上角 */
    100% 0,              /* 右上角 */
    100% 100%,           /* 右下角 */
    180px 100%           /* 左下角 */
  );
}

/* 搜索面板 */
.search-container {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: white;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  max-width: 80%;
  width: 400px;
  transition: all 0.3s ease;
  overflow: hidden;
}

.search-container.collapsed {
  height: 60px;
  width: 400px;
  padding: 5px;
}

.search-container.collapsed .collapsible-content {
  display: none;
}

.search-container-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 5px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 10px;
}

.search-container-header h3 {
  margin: 0;
  font-size: 16px;
}

.toggle-collapse {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 0 5px;
}

.search-container input, .search-container button {
  padding: 8px;
  margin: 5px 0;
  width: 100%;
  box-sizing: border-box;
}

.search-container button {
  background-color: #4CAF50;
  color: white;
  border: none;
  cursor: pointer;
}

.search-container button:hover {
  background-color: #45a049;
}

/* 搜索结果 */
.search-results {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #ddd;
  margin-top: 5px;
}

.search-result-item {
  padding: 8px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
}

.search-result-item:hover {
  background-color: #f5f5f5;
}

/* 已选目的地 */
.selected-destinations {
  margin-top: 10px;
  max-height: 150px;
  overflow-y: auto;
}

.selected-destination {
  background: #f0f0f0;
  padding: 8px;
  margin: 5px 0;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.remove-destination {
  color: red;
  cursor: pointer;
  margin-left: 10px;
}

/* 路径信息 */
.path-info {
  margin-top: 10px;
  padding: 8px;
  background: #e9f7ef;
  border-radius: 4px;
  max-height: 150px;
  overflow-y: auto;
}

/* 交通方式选择 */
.transport-mode {
  margin: 10px 0;
}

.transport-options {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
}

.transport-option {
  flex: 1;
  text-align: center;
  padding: 8px;
  margin: 0 2px;
  background: #f0f0f0;
  border-radius: 4px;
  cursor: pointer;
}

.transport-option.selected {
  background: #4CAF50;
  color: white;
}

.transport-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 拥挤度切换 */
.toggle-container {
  margin: 10px 0;
  display: flex;
  align-items: center;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 30px;
  margin: 0 10px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 30px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 22px;
  width: 22px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: #2196F3;
}

input:checked + .toggle-slider:before {
  transform: translateX(30px);
}

.toggle-label {
  font-size: 14px;
}

/* 景点设施搜索 */
.attraction-facility-search {
  margin: 15px 0;
  padding: 10px;
  background: #f8f8f8;
  border-radius: 4px;
}

.category-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.category-btn {
  flex: 1;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
  background: white;
  transition: all 0.3s;
}

.category-btn.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.search-facility-btn {
  margin-top: 8px !important;
}

/* 附近设施列表 */
.nearby-poi-list {
  margin-top: 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 250px;
  overflow: hidden;
}

.poi-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.poi-list-header h4 {
  margin: 0;
  font-size: 14px;
}

.close-poi-list {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #888;
}

.poi-list-items {
  max-height: 200px;
  overflow-y: auto;
}

.poi-list-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}

.poi-list-item:hover {
  background-color: #f5f5f5;
}

.poi-distance {
  color: #888;
  font-size: 12px;
}

/* 标记样式 */
.start-marker .marker-pin {
  background-color: #4CAF50;
  width: 30px;
  height: 30px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
}

.start-marker .marker-pin .marker-text {
  color: white;
  font-size: 14px;
  font-weight: bold;
  transform: rotate(45deg);
  position: absolute;
}

.destination-marker .marker-number {
  color: white;
  background-color: #4285f4;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
}

.return-marker .marker-pin {
  background-color: #ff5722;
  width: 30px;
  height: 30px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
}

.return-marker .marker-pin span {
  color: white;
  font-size: 12px;
  font-weight: bold;
  transform: rotate(45deg);
  position: absolute;
}

/* 新增：POI标记样式（小尺寸、无数字） */
.poi-marker .marker-pin.poi {
  background-color: #aaa; /* 灰色标记 */
  width: 20px;
  height: 20px;
  border-radius: 50%; /* 圆形标记 */
  transform: none; /* 取消旋转 */
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 鼠标悬停时高亮 */
.poi-marker:hover .marker-pin.poi {
  background-color: #4285f4;
  cursor: pointer;
}

/* 自定义搜索框组样式 */
.custom-search-group {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.facility-search-input {
  flex: 1; /* 与按钮平分宽度 */
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.search-facility-btn {
  flex: 1; /* 与搜索框平分宽度 */
  padding: 6px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>