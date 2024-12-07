import fs from 'fs'; 
import { csvFormat } from 'd3-dsv';

// 데이터 출처 목록 (영문 병원 이름)
const sources = {
    '강원대학교 병원': 'KU',
    '울산대학교 병원': 'UL',
    '서울 아산 병원': 'AS',
    'UNIST': 'UT'
};

// 각 병원별 15명의 고유 user_id 생성 (병원 코드 포함)
const userIds = {};
Object.entries(sources).forEach(([hospital, code]) => {
    userIds[hospital] = Array.from({ length: 15 }, (_, i) => `${code}_${String(i + 1).padStart(3, '0')}`);
});

let data = [];

const startDate = new Date(2024, 0, 1); // January 1, 2024

// user_id별 그룹 관리 객체
const userGroups = {};

Object.keys(userIds).forEach(source => {
    userIds[source].forEach(user_id => {
        // user_id별 group 사전 할당
        if (!userGroups[user_id]) {
            userGroups[user_id] = Math.random() > 0.5 ? 'Normal' : 'Patient';
        }

        for (let week = 0; week < 8; week++) { // 8 weeks
            for (let day = 0; day < 7; day++) { // 7 days per week
                let date = new Date(startDate);
                date.setDate(startDate.getDate() + week * 7 + day); // Increment day

                // Source-specific factors
                const sourceFactor = {
                    '강원대학교 병원': 1,
                    '울산대학교 병원': 1.05,
                    '서울 아산 병원': 0.9,
                    'UNIST': 1.2
                };

                // Periodic data
                const period = 7; // Weekly periodicity
                const sineWave = Math.sin((week * 7 + day) * (2 * Math.PI / period));

                // Random noise
                const randomNoise = () => Math.random() * 0.1;

                // U자형 분포로 PHQ9, CESD, GAD7 값을 생성
                const uShapeRandom = () => {
                    let theta = Math.random() * Math.PI;
                    let val = Math.sin(theta);
                    return val * val;
                };

                const uShapeRandomInRange = (min, max) => Math.round(uShapeRandom() * (max - min)) + min;

                let PHQ9 = uShapeRandomInRange(1, 100);
                let CESD = uShapeRandomInRange(1, 100);
                let GAD7 = uShapeRandomInRange(1, 100);
                let AVGG = parseFloat(((PHQ9 + CESD + GAD7) / 3).toFixed(3));

                // user_id별 사전에 정해진 그룹 사용
                const group = userGroups[user_id];

                let dataPoint = {
                    source: sources[source], // 병원 코드
                    date: date.toISOString().split('T')[0],
                    activity: parseFloat((Math.random() * sourceFactor[source] + randomNoise()).toFixed(3)),
                    app_usage: parseFloat((Math.random() * sourceFactor[source] + randomNoise()).toFixed(3)),
                    bluetooth_connection: parseFloat((Math.random() + randomNoise()).toFixed(3)),
                    light: parseFloat((sineWave + randomNoise()).toFixed(3)),
                    location: parseFloat((Math.random() + randomNoise()).toFixed(5)),
                    phone_call: parseFloat((Math.random() + randomNoise()).toFixed(4)),
                    proximity: parseFloat((Math.random() + randomNoise()).toFixed(3)),
                    response: parseFloat((Math.random() + randomNoise()).toFixed(9)),
                    screen_state: parseFloat((Math.random() + randomNoise()).toFixed(8)),
                    sleep: parseFloat((0.5 + 0.5 * sineWave + randomNoise()).toFixed(1)),
                    sleep_diary: parseFloat((Math.random() + randomNoise()).toFixed(2)),
                    sms: parseFloat((Math.random() + randomNoise()).toFixed(13)),
                    watch_accelerometer: parseFloat((Math.random() + randomNoise()).toFixed(30)),
                    watch_gravity: parseFloat((Math.random() + randomNoise()).toFixed(13)),
                    watch_gyroscope: parseFloat((Math.random() + randomNoise()).toFixed(7)),
                    watch_heart_rate: Math.floor(60 + 20 * sineWave + randomNoise() * 10),
                    watch_light: parseFloat((Math.random() + randomNoise()).toFixed(3)),
                    watch_ppg_green: parseFloat((Math.random() + randomNoise()).toFixed(3)),
                    watch_step_counts: Math.floor(Math.random() * 10000),
                    PHQ9: PHQ9,
                    CESD: CESD,
                    GAD7: GAD7,
                    AVGG: AVGG,
                    user_id: user_id,
                    group: group // 동일한 user_id는 동일한 그룹 할당
                };

                data.push(dataPoint);
            }
        }
    });
});

let csvData = csvFormat(data);

fs.writeFileSync('data.csv', csvData);
console.log('data.csv file has been generated.');
