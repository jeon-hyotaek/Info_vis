document.addEventListener('DOMContentLoaded', function() {
    const clusterSvgWidth = 500;
    const clusterSvgHeight = 500;
    const cellSvgWidth = 600;
    const cellSvgHeight = 500;

    // Initialize global variables
    let allData = [];
    let filteredData = [];
    let dataForClustering = [];

    const sources = ['KU', 'UL', 'AS', 'UT']; 

    const features = [
        'activity', 'app_usage', 'bluetooth_connection', 'light', 'location',
        'phone_call', 'proximity', 'response', 'screen_state', 'sleep',
        'sleep_diary', 'sms', 'watch_accelerometer', 'watch_gravity',
        'watch_gyroscope', 'watch_heart_rate', 'watch_light',
        'watch_ppg_green', 'watch_step_counts'
    ];
    const groupsht = ['Normal', 'Patient'];

    let selectedSources = new Set(sources);
    let selectedGroups = new Set(groupsht);
    let selectedDateRange = [null, null];
    let selectedFeature = null;
    let clusteringResults = { assignments: [], centroids: [] };
    let selectedCluster = 'all'; // Default to all clusters
    let selectedUserId = null;

    // Load the data
    d3.csv("data.csv").then(data => {
        try {
            // Parse data
            data.forEach(d => {
                d.date = new Date(d.date);
                d.PHQ9 = +d.PHQ9;
                d.CESD = +d.CESD;
                d.GAD7 = +d.GAD7;
                d.AVGG = +d.AVGG;
                d.watch_step_counts = +d.watch_step_counts;
            });

            console.log("Data loaded:", data);

            allData = data;
            filteredData = allData;

            initializeSidebar();
            performClustering();
            populateClusterDropdown();
            drawClusteringScatterPlot();
            drawCellVisualization();
            drawCorrelationHeatmap(); 
        } catch (error) {
            console.error("Error parsing data:", error);
        }
    }).catch(error => {
        console.error("Error loading the data:", error);
    });

    // Initialize Sidebar Components
    function initializeSidebar() {
        const dates = allData.map(d => d.date);
        const minDate = d3.min(dates);
        const maxDate = d3.max(dates);

        d3.select("#start-date")
            .attr("min", formatDate(minDate))
            .attr("max", formatDate(maxDate))
            .attr("value", formatDate(minDate))
            .on("change", updateFilters);

        d3.select("#end-date")
            .attr("min", formatDate(minDate))
            .attr("max", formatDate(maxDate))
            .attr("value", formatDate(maxDate))
            .on("change", updateFilters);

        const sourceMapping = {
                'KU': 'Kangwon National University Hospital',
                'UL': 'Ulsan National University Hospital',
                'AS': 'Seoul Asan Medical Center',
                'UT': 'UNIST'
        };    

        const sourcesList = d3.select("#sources-list");
        sources.forEach(source => {
            const label = sourcesList.append("label");
            label.append("input")
                .attr("type", "checkbox")
                .attr("checked", true)
                .attr("value", source)
                .on("change", function() {
                    if (this.checked) {
                        selectedSources.add(this.value);
                    } else {
                        selectedSources.delete(this.value);
                    }
                    updateFilters();
                });
            label.append("span").text(sourceMapping[source]); // 약어 대신 전체 이름 표시
        });

        const groupList = d3.select("#group-list");
        groupsht.forEach(group => {
            const label = groupList.append("label");
            label.append("input")
                .attr("type", "checkbox")
                .attr("checked", true)
                .attr("value", group)
                .on("change", function() {
                    if (this.checked) {
                        selectedGroups.add(this.value);
                    } else {
                        selectedGroups.delete(this.value);
                    }
                    updateFilters(); // 필터링 함수 호출
                });
            label.append("span").text(group);
        });

        const featureList = d3.select("#features");
        features.forEach(feature => {
            const listItem = featureList.append("li")
                .attr("class", "feature-item")
                .text(feature)
                .on("click", function () {
                    // If the same feature is clicked again, hide the graph
                    if (selectedFeature === feature) {
                        selectedFeature = null;
                        d3.selectAll(".feature-item").classed("selected", false);
                        d3.selectAll(".feature-graph").remove();
                    } else {
                        selectedFeature = feature;
                        d3.selectAll(".feature-item").classed("selected", false);
                        d3.select(this).classed("selected", true);
    
                        // Remove any existing graphs
                        d3.selectAll(".feature-graph").remove();
    
                        // Add feature graph below the selected feature
                        const graphContainer = d3.select(this.parentNode)
                            .insert("div", `:nth-child(${features.indexOf(feature) + 2})`)
                            .attr("class", "feature-graph");
    
                        drawFeatureGraph(feature, graphContainer);
                    }
                });
        });


    }

    // Format date to YYYY-MM-DD
    function formatDate(date) {
        const year = date.getFullYear();
        const month = (`0${date.getMonth()+1}`).slice(-2);
        const day = (`0${date.getDate()}`).slice(-2);
        return `${year}-${month}-${day}`;
    }

    // Update Filters based on sidebar selections
    function updateFilters() {
        const startDate = new Date(d3.select("#start-date").property("value"));
        const endDate = new Date(d3.select("#end-date").property("value"));
    
        filteredData = allData.filter(d => {
            return selectedSources.has(d.source) &&    // 소스 필터
                   selectedGroups.has(d.group) &&     // 그룹 필터 추가
                   d.date >= startDate &&
                   d.date <= endDate;
        });
    
        // 필터링 결과에 따라 시각화 업데이트
        performClustering();          // 클러스터링 업데이트
        populateClusterDropdown();    // 클러스터 선택 드롭다운 업데이트
        drawClusteringScatterPlot();  // 클러스터 스캐터 플롯 업데이트
        drawCellVisualization();      // 셀 시각화 업데이트
        drawCorrelationHeatmap();     // 상관 행렬 히트맵 업데이트
        if (selectedFeature) {
            drawFeatureGraph(selectedFeature);  // 선택된 Feature 그래프 업데이트
        }
    }
    

    function performClustering() {
        // Aggregate PHQ9, CESD, GAD7 per user_id
        const userDataMap = d3.rollups(filteredData, v => ({
            PHQ9: d3.mean(v, d => d.PHQ9),
            CESD: d3.mean(v, d => d.CESD),
            GAD7: d3.mean(v, d => d.GAD7)
        }), d => d.user_id);

        // Prepare data for clustering
        dataForClustering = userDataMap.map(([user_id, scores]) => ({
            user_id: user_id,
            values: [scores.PHQ9, scores.CESD, scores.GAD7]
        }));

        const dataValues = dataForClustering.map(d => d.values);

        if (dataValues.length === 0) {
            console.warn("No data for clustering.");
            return; // Ensure data exists
        }

        const k = 3; // Number of clusters
        const clusters = kMeans(dataValues, k);
        clusteringResults = clusters;

        // Map cluster assignments to user_ids
        dataForClustering.forEach((d, i) => {
            d.cluster = clusters.assignments[i];
        });

        // Assign clusters to filteredData rows based on user_id
        const userClusterMap = new Map(dataForClustering.map(d => [d.user_id, d.cluster]));

        filteredData.forEach(d => {
            d.cluster = userClusterMap.get(d.user_id);
        });

        // Perform PCA
        const pcaResults = pca(dataValues);

        // Assign PCA results to dataForClustering
        dataForClustering.forEach((d, i) => {
            d.pcaX = pcaResults[i][0];
            d.pcaY = pcaResults[i][1];
        });
    }

    // K-means clustering for multidimensional data
    function kMeans(data, k) {
        // Initialize centroids randomly
        let centroids = [];
        const shuffled = data.slice().sort(() => 0.5 - Math.random());
        centroids = shuffled.slice(0, k);

        let assignments = new Array(data.length);
        let iterations = 0;
        let converged = false;

        while (!converged && iterations < 100) {
            // Assign points to nearest centroid
            for (let i = 0; i < data.length; i++) {
                let minDist = Infinity;
                let cluster = 0;
                for (let j = 0; j < k; j++) {
                    const dist = euclideanDistance(data[i], centroids[j]);
                    if (dist < minDist) {
                        minDist = dist;
                        cluster = j;
                    }
                }
                assignments[i] = cluster;
            }

            // Recompute centroids
            let newCentroids = [];
            for (let j = 0; j < k; j++) {
                const clusterPoints = data.filter((d, i) => assignments[i] === j);
                if (clusterPoints.length > 0) {
                    const meanPoint = clusterPoints[0].map((_, idx) => d3.mean(clusterPoints, d => d[idx]));
                    newCentroids[j] = meanPoint;
                } else {
                    newCentroids[j] = centroids[j];
                }
            }

            // Check for convergence
            converged = centroids.every((c, i) => arraysEqual(c, newCentroids[i]));
            centroids = newCentroids;
            iterations++;
        }

        return { assignments, centroids };
    }

    function euclideanDistance(a, b) {
        return Math.sqrt(a.reduce((sum, val, idx) => sum + Math.pow(val - b[idx], 2), 0));
    }

    function arraysEqual(a, b) {
        return a.length === b.length && a.every((val, idx) => val === b[idx]);
    }

    function pca(data) {
        // Center the data
        const means = math.mean(data, 0);
        const centeredData = data.map(row => math.subtract(row, means));

        // Calculate covariance matrix
        const covarianceMatrix = math.multiply(math.transpose(centeredData), centeredData);
        const eig = math.eigs(covarianceMatrix);

        // Get indices of the top 2 eigenvalues
        const idx = math.range(0, eig.values.length)._data;
        idx.sort((a, b) => eig.values[b] - eig.values[a]);

        // Get the eigenvectors corresponding to the top 2 eigenvalues
        const top2Vectors = eig.vectors.map(row => [row[idx[0]], row[idx[1]]]);

        // Project data onto the top 2 principal components
        const projectedData = centeredData.map(row => math.multiply(row, top2Vectors));

        return projectedData;
    }

    // Populate Cluster Selection Dropdown
    function populateClusterDropdown() {
        const dropdown = d3.select("#cluster-dropdown");
        dropdown.selectAll("option").remove();
        dropdown.append("option")
            .attr("value", "all")
            .text("All Clusters");
        for (let i = 0; i < clusteringResults.centroids.length; i++) {
            dropdown.append("option")
                .attr("value", i)
                .text(`Cluster ${i}`);
        }

        dropdown.on("change", function() {
            selectedCluster = this.value === "all" ? "all" : +this.value;
            updateClusteringScatterPlot();
            drawCellVisualization();
        });
    }

    function drawClusteringScatterPlot() {
        const svg = d3.select("#cluster-svg");
        svg.selectAll("*").remove(); // Clear previous drawings

        const margin = {top: 40, right: 40, bottom: 60, left: 60};
        const width = clusterSvgWidth - margin.left - margin.right;
        const height = clusterSvgHeight - margin.top - margin.bottom;

        const g = svg.append("g")
                    .attr("transform", `translate(${margin.left},${margin.top})`);

        // Scales based on PCA results
        const x = d3.scaleLinear()
                    .domain(d3.extent(dataForClustering, d => d.pcaX)).nice()
                    .range([0, width]);

        const y = d3.scaleLinear()
                    .domain(d3.extent(dataForClustering, d => d.pcaY)).nice()
                    .range([height, 0]);

        // Axes
        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));

        g.append("g")
            .call(d3.axisLeft(y));

        // Modern Color Scale for Clusters
        const color = d3.scaleOrdinal()
                        .domain(d3.range(clusteringResults.centroids.length))
                        .range(['#66c2a5','#fc8d62','#8da0cb']);

        // Tooltip
        const tooltip = d3.select("body").append("div")
                          .attr("class", "tooltip")
                          .style("display", "none");

        // For keeping track of selected point
        let selectedPointId = null;

        const circles = g.selectAll("circle")
            .data(dataForClustering)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.pcaX))
            .attr("cy", d => y(d.pcaY))
            .attr("r", 8) // Larger circles
            .attr("fill", d => color(d.cluster))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .attr("opacity", d => selectedCluster === "all" || d.cluster === selectedCluster ? 1 : 0.2)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                tooltip.style("display", "block")
                       .html(`User ID: ${d.user_id}<br>Cluster: ${d.cluster}`);
            })
            .on("mousemove", function(event) {
                tooltip.style("left", (event.pageX + 10) + "px")
                       .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("display", "none");
            })
            .on("click", function(event, d) {
                if (selectedPointId !== null) {
                    g.selectAll("circle").filter(p => p.user_id === selectedPointId)
                      .attr("stroke", "#fff").attr("stroke-width", 1);
                }
                selectedPointId = d.user_id;
                selectedUserId = d.user_id; // 추가된 부분
                d3.select(this).attr("stroke", "#000").attr("stroke-width", 2);
        
                selectedCluster = d.cluster;
                d3.select("#cluster-dropdown").property("value", d.cluster);
                updateClusteringScatterPlot();
                drawCellVisualization();
            });

        // Apply modern styling
        // Add drop shadow
        svg.append("defs").append("filter")
            .attr("id", "drop-shadow")
            .append("feDropShadow")
            .attr("dx", 1)
            .attr("dy", 1)
            .attr("stdDeviation", 2);

        circles.attr("filter", "url(#drop-shadow)");
    }

    function updateClusteringScatterPlot() {
        const svg = d3.select("#cluster-svg");
        const g = svg.select("g");

        // Update the opacity of circles based on selectedCluster
        g.selectAll("circle")
         .attr("opacity", d => selectedCluster === "all" || d.cluster === selectedCluster ? 1 : 0.2);
    }

    function drawCellVisualization() {
        const container = d3.select("#cell-container");
        container.style("overflow", "auto");
        container.selectAll("*").remove(); // Clear previous drawings
    
        const cellSvgWidth = 600;
        const cellSvgHeight = 500;
        const margin = {top: 60, right: 40, bottom: 60, left: 60};
    
        const sources = ['KU', 'UL', 'AS', 'UT']; // 병원 소스 코드
        let validSources = [];
    
        // 데이터 필터링: 각 소스에 데이터가 있는지 확인
        sources.forEach(source => {
            const sourceData = filteredData.filter(d => d.source === source);
            if (sourceData.length > 0) {
                validSources.push(source); // 데이터가 있는 소스만 추가
            }
        });
    
        const individualWidth = cellSvgWidth / 2; 
        const individualHeight = cellSvgHeight / 2; 
    
        validSources.forEach((source, index) => {
            const svg = container.append("svg")
                .attr("id", `cell-svg-${source}`)
                .attr("width", individualWidth)
                .attr("height", individualHeight)
                .style("display", "inline-block")
                .style("vertical-align", "top")
                .style("margin", "10px");
    
            const width = individualWidth - margin.left - margin.right;
            const height = individualHeight - margin.top - margin.bottom;
    
            drawCellVisualizationForSource(svg, source, margin, width, height);
        });
    }
    
    
    function drawCellVisualizationForSource(svg, source, margin, width, height) {
        // 데이터 필터링: 현재 필터된 데이터 중 해당 source만
        const sourceData = filteredData.filter(d => d.source === source);
    
        const weeks = 8; 
    
        // startDate 결정
        const sortedDates = sourceData.map(d => d.date).sort((a, b) => new Date(a) - new Date(b));
        const startDate = sortedDates[0] ? new Date(sortedDates[0]) : null;
    
        if (!startDate) {
            // 데이터가 없을 경우 메세지 표시

            return;
        }
    
        function getWeekNumber(date) {
            const diffTime = new Date(date) - startDate;
            const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
            return Math.min(diffWeeks, weeks);
        }
    
        sourceData.forEach(d => {
            d.week = getWeekNumber(d.date);
        });
    
        // 선택된 클러스터에 따른 데이터 필터링
        let dataToVisualize = sourceData;
        if (selectedCluster !== 'all') {
            dataToVisualize = sourceData.filter(d => d.cluster === selectedCluster);
        }
    
        const userIds = Array.from(new Set(dataToVisualize.map(d => d.user_id))).sort();
    
        if (userIds.length === 0) {
            // 해당 cluster나 조건에 맞는 유저 없음
            svg.append("text")
                .attr("x", (width + margin.left + margin.right) / 2)
                .attr("y", margin.top)
                .attr("text-anchor", "middle")
                .style("font-size", "14px")
                .text(`No data for Source: ${source} in Cluster ${selectedCluster}`);
            return;
        }
    
        // Nested Data: user_id -> week별 평균
        const nestedData = d3.group(dataToVisualize, d => d.user_id);
    
        const matrix = [];
        for (let week = 1; week <= weeks; week++) {
            userIds.forEach(user_id => {
                const userData = nestedData.get(user_id) || [];
                const weekData = userData.filter(d => d.week === week);
                const avgPHQ9 = weekData.length > 0 ? d3.mean(weekData, d => d.PHQ9) : 0;
                matrix.push({
                    user_id,
                    week,
                    PHQ9: avgPHQ9
                });
            });
        }
    
        const cellPadding = 2;
        const cellSize = 30;
    
        const gridWidth = cellSize * userIds.length + cellPadding * (userIds.length - 1);
        const gridHeight = cellSize * weeks + cellPadding * (weeks - 1);
    
        svg.attr("width", gridWidth + margin.left + margin.right)
           .attr("height", gridHeight + margin.top + margin.bottom);
    
        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    
        const x = d3.scaleBand()
            .domain(userIds)
            .range([0, gridWidth])
            .padding(0);
    
        const y = d3.scaleBand()
            .domain(d3.range(1, weeks + 1))
            .range([0, gridHeight])
            .padding(0);
    
        const colorScale = d3.scaleLinear()
            .domain([0, 100])
            .range(["#ffffff", "#ff0000"]);
    
        const tooltip = d3.select("body").append("div")
                          .attr("class", "tooltip")
                          .style("display", "none")
                          .style("position", "absolute")
                          .style("background-color", "#fff")
                          .style("border", "1px solid #ccc")
                          .style("padding", "8px")
                          .style("border-radius", "4px")
                          .style("pointer-events", "none")
                          .style("font-size", "12px");
        
        const sourceMapping = {
            'KU': 'Kangwon National University Hospital',
            'UL': 'Ulsan National University Hospital',
            'AS': 'Seoul Asan Medical Center',
            'UT': 'UNIST'
        };

        g.selectAll("rect")
            .data(matrix)
            .enter()
            .append("rect")
            .attr("x", d => x(d.user_id))
            .attr("y", d => y(d.week))
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("fill", d => colorScale(d.PHQ9))
            .attr("stroke", "#ccc")
            .on("mouseover", function(event, d) {
                d3.select(this).attr("stroke", "#000");
                tooltip.style("display", "block")
                       .html(`User ID: ${d.user_id}<br>Week: ${d.week}<br>PHQ9: ${d.PHQ9.toFixed(2)}`);
            })
            .on("mousemove", function(event) {
                tooltip.style("left", (event.pageX + 10) + "px")
                       .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke", "#ccc");
                tooltip.style("display", "none");
            })
            .on("click", function(event, d) {
                drawUserBarCharts(d.user_id, source);
                drawPersonalInfo(d.user_id);  // Personal Information 갱신 호출

            });
    
        const xAxis = d3.axisTop(x)
                        .tickSize(0)
                        .tickFormat(d => d.slice(0, 2) + d.slice(4)) // 3, 4번째 글자 제거
                        .tickPadding(5);
    
        const yAxis = d3.axisLeft(y)
                        .tickSize(0)
                        .tickFormat(d => `W${d}`)
                        .tickPadding(5);
    
        g.append("g")
            .attr("transform", `translate(0,0)`)
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "middle");
    
        g.append("g")
            .call(yAxis)
            .selectAll("text")
            .style("text-anchor", "end");
    
        

        svg.append("text")
            .attr("x", (gridWidth + margin.left + margin.right) / 2)
            .attr("y", margin.top - 30)
            .attr("text-anchor", "middle")
            .style("font-size", "18px")
            .text(`Source: ${sourceMapping[source] || source}`);

        svg.append("text")
            .attr("x", (gridWidth + margin.left + margin.right) / 2)
            .attr("y", margin.top - 10)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")    
        // selectedUserId와 selectedFeature가 정의되어 있고 해당 유저가 userIds에 포함될 때만 Feature Graph를 보여주기
        if (typeof selectedUserId !== 'undefined' && typeof selectedFeature !== 'undefined' && 
            selectedUserId !== null && selectedFeature !== null &&
            userIds.includes(selectedUserId)) {
            drawFeatureGraphInCell(g, x(selectedUserId), gridHeight + cellPadding * (weeks - 1) + 20, cellSize, selectedUserId, source);
        }
    }
    
    function drawFeatureGraphInCell(container, xPosition, yPosition, cellSize, userId, source) {
        const userFeatureData = filteredData.filter(d => d.user_id === userId && d.source === source && d[selectedFeature] !== null && !isNaN(d[selectedFeature]));
    
        if (userFeatureData.length === 0) return;
    
        const width = cellSize;
        const height = 100; 
    
        const x = d3.scaleTime()
                    .domain(d3.extent(userFeatureData, d => new Date(d.date)))
                    .range([0, width]);
    
        const y = d3.scaleLinear()
                    .domain([0, d3.max(userFeatureData, d => +d[selectedFeature])]).nice()
                    .range([height, 0]);
    
        const line = d3.line()
                    .curve(d3.curveMonotoneX)
                    .x(d => x(new Date(d.date)))
                    .y(d => y(+d[selectedFeature]));
    
        const area = d3.area()
                    .curve(d3.curveMonotoneX)
                    .x(d => x(new Date(d.date)))
                    .y0(height)
                    .y1(d => y(+d[selectedFeature]));
    
        const gradientId = `gradient-${userId}-${selectedFeature}-${source}`;
        const filterId = `dropshadow-${userId}-${selectedFeature}-${source}`;
    
        const defs = container.append("defs");
    
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "0%").attr("y2", "100%");
    
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "#007BFF")
            .attr("stop-opacity", 0.8);
    
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "#FFFFFF")
            .attr("stop-opacity", 0);
    
        const filter = defs.append("filter")
            .attr("id", filterId)
            .attr("height", "130%");
    
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 3)
            .attr("result", "blur");
    
        filter.append("feOffset")
            .attr("in", "blur")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetBlur");
    
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "offsetBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    
        container.append("path")
            .datum(userFeatureData)
            .attr("fill", `url(#${gradientId})`)
            .attr("d", area)
            .attr("transform", `translate(${xPosition},${yPosition})`);
    
        container.append("path")
            .datum(userFeatureData)
            .attr("fill", "none")
            .attr("stroke", "#007BFF")
            .attr("stroke-width", 2)
            .attr("d", line)
            .attr("filter", `url(#${filterId})`)
            .attr("transform", `translate(${xPosition},${yPosition})`);
    }
    
    
    
    // Function to draw bar charts for the selected user
function drawUserBarCharts(user_id, source) {
    const container = d3.select("#bar-chart-container");
    container.html(""); // Clear previous charts

    // Filter data for the selected user and source
    const userData = filteredData.filter(d => d.user_id === user_id && d.source === source);

    if (userData.length === 0) {
        container.append("p").text(`No data available for User ID: ${user_id}`);
        return;
    }

    // Determine the start date to calculate week numbers
    const sortedDates = userData.map(d => d.date).sort((a, b) => a - b);
    const startDate = sortedDates[0];

    // Function to calculate week number
    function getWeekNumber(date) {
        const diffTime = date - startDate;
        const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1; // Week 1 onwards
        return diffWeeks;
    }

    // Assign week numbers to data
    userData.forEach(d => {
        d.week = getWeekNumber(d.date);
    });

    // Aggregate data by week for PHQ9, CESD, GAD7
    const weeks = d3.range(1, 9); // Assuming weeks 1 to 8

    const dataByWeek = weeks.map(week => {
        const weekData = userData.filter(d => d.week === week);
        return {
            week: week,
            PHQ9: weekData.length > 0 ? d3.mean(weekData, d => d.PHQ9) : 0,
            CESD: weekData.length > 0 ? d3.mean(weekData, d => d.CESD) : 0,
            GAD7: weekData.length > 0 ? d3.mean(weekData, d => d.GAD7) : 0
        };
    });

    // Scores to plot
    const scores = ["PHQ9", "CESD", "GAD7"];

    scores.forEach(score => {
        // Create SVG for each bar chart
        const svgWidth = 500;
        const svgHeight = 350;
        const margin = { top: 40, right: 20, bottom: 60, left: 50 };
        const width = svgWidth - margin.left - margin.right;
        const height = svgHeight - margin.top - margin.bottom;

        const svg = container.append("svg")
            .attr("width", svgWidth)
            .attr("height", svgHeight)
            .style("margin-bottom", "20px");

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // X scale
        const x = d3.scaleBand()
            .domain(weeks.map(d => `Week ${d}`))
            .range([0, width])
            .padding(0.1);

        // Y scale
        const y = d3.scaleLinear()
            .domain([0, 100]).nice()
            .range([height, 0]);

        // X axis
        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .attr("text-anchor", "end");

        // Y axis
        g.append("g")
            .call(d3.axisLeft(y));

        // Bars
        // drawUserBarCharts 함수 내부 바 그리기 부분을 수정

        g.selectAll(".bar")
            .data(dataByWeek)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => x(`Week ${d.week}`))
            .attr("y", d => y(d[score]))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(d[score]))
            .attr("fill", d => d[score] > 65 ? "red" : "#69b3a2"); // 70점 초과시 빨간색


        // Title
        svg.append("text")
            .attr("x", svgWidth / 2)
            .attr("y", margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .text(`${score} Scores for User ID: ${user_id} in ${source}`);
    });
}


function drawFeatureGraph(feature, container) {
    container.html(""); // Clear any existing graph

    // 동적으로 사이즈를 계산
    const containerWidth = container.node().getBoundingClientRect().width;
    const svgWidth = containerWidth; // 그래프 너비 90%
    const svgHeight = 300;
    const margin = { top: 20, right: 40, bottom: 40, left: 50 }; // 오른쪽에 여백 추가
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .style("background-color", "transparent"); // 배경은 container가 담당

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Aggregate data by date
    const aggregated = d3.rollup(
        filteredData,
        v => d3.mean(v, d => +d[feature]),
        d => d.date
    );

    const data = Array.from(aggregated, ([date, value]) => ({ date, value })).sort((a, b) => a.date - b.date);

    // Add padding to x-axis domain
    const xPaddingFactor = 0.05; // 5% padding on each side
    const xExtent = d3.extent(data, d => d.date);
    const xRange = xExtent[1] - xExtent[0];
    const x = d3.scaleTime()
        .domain([new Date(xExtent[0] - xRange * xPaddingFactor), new Date(xExtent[1] + xRange * xPaddingFactor)])
        .range([0, width]);

    // Y scale
    const y = d3.scaleLinear()
        .domain([d3.min(data, d => d.value), d3.max(data, d => d.value)]).nice()
        .range([height, 0]);

    // Axes
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5))
        .selectAll("text")
        .style("fill", "black") // 글씨 색상 설정
        .style("font-weight", "bold"); // 글씨 두께 설정

    g.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("fill", "black") // 글씨 색상 설정
        .style("font-weight", "bold"); // 글씨 두께 설정

        
    // Line path
    const line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.value));

    g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("d", line);


    // Title
    svg.append("text")
        .attr("x", svgWidth / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(`Selected Feature: ${feature}`);
}


    function drawCorrelationHeatmap() {
        // Filter numerical data
        const numericFeatures = features;
    
        // Prepare data: extract only the numeric features
        const dataMatrix = filteredData.map(d => {
            let row = [];
            numericFeatures.forEach(feature => {
                row.push(d[feature]);
            });
            return row;
        });
    
        // Calculate correlation matrix
        const correlationMatrix = [];
        for (let i = 0; i < numericFeatures.length; i++) {
            correlationMatrix[i] = [];
            for (let j = 0; j < numericFeatures.length; j++) {
                const x = dataMatrix.map(row => row[i]);
                const y = dataMatrix.map(row => row[j]);
                const corr = pearsonCorrelation(x, y);
                correlationMatrix[i][j] = corr;
            }
        }
    
        // **여기서부터 추가된 코드입니다**
    
        // 각 특징의 중요도 계산 (절대값의 합으로 계산)
        const importanceScores = numericFeatures.map((feature, index) => {
            const totalCorrelation = d3.sum(correlationMatrix[index].map(Math.abs)) - 1; // 자기 자신 제외
            return { feature, score: totalCorrelation };
        });
    
        // 중요도 순으로 내림차순 정렬
        importanceScores.sort((a, b) => b.score - a.score);
        const topImportanceScores = importanceScores.slice(0, 10);
    
        // 중요도 테이블 생성
        const importanceContainer = d3.select("#importance-table-container");
        importanceContainer.html(""); // 이전 내용 제거
    
        const table = importanceContainer.append("table").attr("class", "importance-table");
        const thead = table.append("thead");
        const tbody = table.append("tbody");
    
        // 테이블 헤더
        thead.append("tr")
            .selectAll("th")
            .data(["Feature", "Total Correlation"])
            .enter()
            .append("th")
            .text(d => d);
    
        // 테이블 행
        const rows = tbody.selectAll("tr")
            .data(topImportanceScores)
            .enter()
            .append("tr");
    
        rows.append("td").text(d => d.feature);
        rows.append("td").text(d => d.score.toFixed(2));
    
        // **여기까지 추가된 코드입니다**
    
        // 기존 히트맵 코드 계속...
        // Create SVG container
        const margin = { top: 100, right: 100, bottom: 10, left: 130 };
        const svgWidth = 600;
        const svgHeight = 500;
        const width = svgWidth - margin.left - margin.right;
        const height = svgHeight - margin.top - margin.bottom;
    
        const container = d3.select("#correlation-heatmap-container");
        container.html(""); // Clear previous content
    
        const svg = container.append("svg")
            .attr("width", svgWidth)
            .attr("height", svgHeight)
            .style("border", "none");
    
        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
    
        // Scales
        const x = d3.scaleBand()
            .domain(numericFeatures)
            .range([0, width])
            .padding(0.05);
    
        const y = d3.scaleBand()
            .domain(numericFeatures)
            .range([0, height])
            .padding(0.05);
    
        // Color scale ------ 색상 변경
        const colorScale = d3.scaleSequential(d3.interpolateRdBu)
            .domain([0.1, -0.1]);
    
        // Tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("display", "none")
            .style("position", "absolute")
            .style("background-color", "#fff")
            .style("border", "1px solid #ccc")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("font-size", "12px");
    
        // Draw cells
        const cells = g.selectAll(".cell")
            .data(d3.cross(d3.range(numericFeatures.length), d3.range(numericFeatures.length)))
            .enter()
            .append("rect")
            .attr("x", d => x(numericFeatures[d[0]]))
            .attr("y", d => y(numericFeatures[d[1]]))
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .attr("fill", d => colorScale(correlationMatrix[d[1]][d[0]]))
            .on("mouseover", function(event, d) {
                const corrValue = correlationMatrix[d[1]][d[0]].toFixed(2);
                tooltip.style("display", "block")
                    .html(`<strong>${numericFeatures[d[0]]}</strong> & <strong>${numericFeatures[d[1]]}</strong><br>Correlation: ${corrValue}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
                d3.select(this).attr("stroke", "#000").attr("stroke-width", 1);
            })
            .on("mouseout", function() {
                tooltip.style("display", "none");
                d3.select(this).attr("stroke", null);
            });
    
        // Add feature labels
        const xAxis = g.append("g")
            .attr("transform", `translate(0, ${-5})`)
            .selectAll("text")
            .data(numericFeatures)
            .enter()
            .append("text")
            .attr("x", d => x(d) + x.bandwidth() / 2)
            .attr("y", 0)
            .attr("text-anchor", "start")
            .attr("transform", d => `rotate(-45, ${x(d) + x.bandwidth() / 2}, 0)`)
            .text(d => d)
            .style("font-size", "12px");
    
        const yAxis = g.append("g")
            .attr("transform", `translate(${-5}, 0)`)
            .selectAll("text")
            .data(numericFeatures)
            .enter()
            .append("text")
            .attr("x", 0)
            .attr("y", d => y(d) + y.bandwidth() / 2)
            .attr("text-anchor", "end")
            .attr("dy", "0.35em")
            .text(d => d)
            .style("font-size", "12px");
    
        // Add title
        svg.append("text")
            .attr("x", svgWidth / 2)
            .attr("y", margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold");
    
        // Add legend
        const defs = svg.append("defs");
    
        const legendWidth = 20;
        const legendHeight = 100;
    
        const legendGradient = defs.append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%").attr("y1", "100%")
            .attr("x2", "0%").attr("y2", "0%");
    
        legendGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", colorScale(-1));
    
        legendGradient.append("stop")
            .attr("offset", "50%")
            .attr("stop-color", colorScale(0));
    
        legendGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", colorScale(1));
    
        svg.append("rect")
            .attr("x", svgWidth - margin.right + 40)
            .attr("y", margin.top)
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#legend-gradient)");
    
        // Legend scale
        const legendScale = d3.scaleLinear()
            .domain([-1, 1])
            .range([legendHeight, 0]);
    
        const legendAxis = d3.axisRight(legendScale)
            .ticks(5)
            .tickSize(0)
            .tickFormat(d3.format(".2f"));
    
        svg.append("g")
            .attr("transform", `translate(${svgWidth - margin.right + 60}, ${margin.top})`)
            .call(legendAxis)
            .select(".domain").remove();
    }
    

    // Pearson Correlation Function
    function pearsonCorrelation(x, y) {
        const n = x.length;
        const meanX = d3.mean(x);
        const meanY = d3.mean(y);
        const numerator = d3.sum(x.map((xi, i) => (xi - meanX) * (y[i] - meanY)));
        const denominator = Math.sqrt(
            d3.sum(x.map(xi => (xi - meanX) ** 2)) *
            d3.sum(y.map(yi => (yi - meanY) ** 2))
        );
        return denominator === 0 ? 0 : numerator / denominator;
    }
    
    

    // 클러스터 스캐터 플롯 내에서 사용자를 클릭했을 때 selectedUserId 설정 후 personal info 업데이트
// 이 부분은 drawClusteringScatterPlot() 함수 내 circle.on("click") 핸들러에서 이미 구현했을 것으로 가정
// 예:
// .on("click", function(event, d) {
//    selectedUserId = d.user_id; // 문자열 user_id
//    drawPersonalInfo(selectedUserId);
//    ...
// });

function drawPersonalInfo(user_id) {
    // user_id에 해당하는 데이터 필터
    const userData = filteredData.filter(d => d.user_id === user_id);

    const sourceMapping = {
        'KU': 'Kangwon National University Hospital',
        'UL': 'Ulsan National University Hospital',
        'AS': 'Seoul Asan Medical Center',
        'UT': 'UNIST'
    };

    // 데이터가 없으면 테이블 초기화
    if (userData.length === 0) {
        d3.select("#info-user-id").text("");
        d3.select("#info-source").text("");
        d3.select("#info-group").text("");
        d3.select("#info-cluster").text("");
        d3.select("#info-phq9").text("");
        d3.select("#info-cesd").text("");
        d3.select("#info-gad7").text("");
        d3.select("#info-risk-week").text("");
        d3.select("#personal-bar-chart-container").html("");
        return;
    }

    // 해당 user의 source, group, cluster 정보 추출
    const userSources = Array.from(new Set(userData.map(d => d.source)))
        .map(source => sourceMapping[source]); // 소스 매핑 적용
    const sourceStr = userSources.join(", ");

    const userClusters = Array.from(new Set(userData.map(d => d.cluster)));
    const clusterStr = userClusters.join(", ");

    const userGroup = userData[0].group; // 동일 user_id 내 group은 동일하다고 가정

    // 평균값 계산
    const avgPHQ9 = d3.mean(userData, d => d.PHQ9);
    const avgCESD = d3.mean(userData, d => d.CESD);
    const avgGAD7 = d3.mean(userData, d => d.GAD7);

    // 테이블 업데이트
    d3.select("#info-user-id").text(user_id);
    d3.select("#info-source").text(sourceStr);
    d3.select("#info-group").text(userGroup);
    d3.select("#info-cluster").text(clusterStr);
    d3.select("#info-phq9").text(avgPHQ9 ? avgPHQ9.toFixed(2) : "N/A");
    d3.select("#info-cesd").text(avgCESD ? avgCESD.toFixed(2) : "N/A");
    d3.select("#info-gad7").text(avgGAD7 ? avgGAD7.toFixed(2) : "N/A");

    // 주차별 데이터 준비
    const sortedDates = userData.map(d => new Date(d.date)).sort((a,b) => a-b);
    const startDate = sortedDates[0];

    // 주차 계산 함수
    function getWeekNumber(date) {
        const diffTime = new Date(date) - startDate;
        const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1; 
        return diffWeeks;
    }

    userData.forEach(d => {
        d.week = getWeekNumber(d.date);
    });

    const weeks = d3.range(1, 9); // 1~8주 가정

    const weeklyData = weeks.map(week => {
        const weekData = userData.filter(d => d.week === week);
        return {
            week: week,
            PHQ9: weekData.length > 0 ? d3.mean(weekData, d => d.PHQ9) : 0,
            CESD: weekData.length > 0 ? d3.mean(weekData, d => d.CESD) : 0,
            GAD7: weekData.length > 0 ? d3.mean(weekData, d => d.GAD7) : 0
        };
    });

    // 위험 주간(PHQ9 최대) 계산
    let maxPHQ9 = -Infinity;
    let riskWeek = null;
    weeklyData.forEach(d => {
        if (d.PHQ9 > maxPHQ9) {
            maxPHQ9 = d.PHQ9;
            riskWeek = d.week;
        }
    });

    d3.select("#info-risk-week").text(riskWeek ? `Week ${riskWeek}` : "N/A");

    // 라인차트 그리기 (personal-bar-chart-container를 라인차트로 사용)
    drawPersonalLineChart(weeklyData);
}

function drawPersonalLineChart(weeklyData) {
    const container = d3.select("#personal-bar-chart-container");
    container.html("");

    const svgWidth = 500;
    const svgHeight = 350;
    const margin = {top: 30, right: 100, bottom: 50, left: 50};
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([1, d3.max(weeklyData, d => d.week)])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(weeklyData, d => Math.max(d.PHQ9, d.CESD, d.GAD7))]).nice()
        .range([height, 0]);

    const xAxis = d3.axisBottom(x).ticks(8).tickFormat(d => `W${d}`);
    const yAxis = d3.axisLeft(y);

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .attr("text-anchor", "end");

    g.append("g")
        .call(yAxis);

    const line = d3.line()
        .x(d => x(d.week))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

    const metrics = [
        {name: "PHQ9", color: "steelblue"},
        {name: "CESD", color: "green"},
        {name: "GAD7", color: "orange"}
    ];

    metrics.forEach(metric => {
        const metricData = weeklyData.map(d => ({week: d.week, value: d[metric.name]}));
        g.append("path")
            .datum(metricData)
            .attr("fill", "none")
            .attr("stroke", metric.color)
            .attr("stroke-width", 2)
            .attr("d", line);

        // 범례
        svg.append("text")
            .attr("x", width + margin.left + 20)
            .attr("y", margin.top + metrics.indexOf(metric)*20)
            .attr("fill", metric.color)
            .style("font-size", "14px")
            .text(metric.name);
    });
}


});
