import fs from 'fs';
import { csvFormat } from 'd3-dsv';

// 데이터 출처 목록
const sources = ['A병원', 'B병원', 'C병원', 'UNIST'];

// 각 출처별로 15개의 고유 user_id 생성
const userIds = {
    'A병원': Array.from({ length: 15 }, (_, i) => i + 1),
    'B병원': Array.from({ length: 15 }, (_, i) => i + 16),
    'C병원': Array.from({ length: 15 }, (_, i) => i + 31),
    'UNIST': Array.from({ length: 15 }, (_, i) => i + 46)
};

let data = [];

const startDate = new Date(2024, 0, 1); // January 1, 2024
sources.forEach(source => {
    userIds[source].forEach(user_id => {
        for (let week = 0; week < 8; week++) { // 8 weeks
            for (let day = 0; day < 7; day++) { // 7 days per week
                let date = new Date(startDate);
                date.setDate(startDate.getDate() + week * 7 + day); // Increment day

                // Source-specific factors
                const sourceFactor = {
                    'A병원': 1,
                    'B병원': 1.05,
                    'C병원': 0.9,
                    'UNIST': 1.2
                };

                // Periodic data
                const period = 7; // Weekly periodicity
                const sineWave = Math.sin((week * 7 + day) * (2 * Math.PI / period));

                // Random noise
                const randomNoise = () => Math.random() * 0.1;

                let PHQ9 = Math.floor(Math.random() * 100) + 1;
                let CESD = Math.floor(Math.random() * 100) + 1;
                let GAD7 = Math.floor(Math.random() * 100) + 1;
                let AVGG = parseFloat(((PHQ9 + CESD + GAD7) / 3).toFixed(3));

                let dataPoint = {
                    source: source,
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
                    user_id: user_id
                };

                data.push(dataPoint);
            }
        }
    });
});

let csvData = csvFormat(data);

fs.writeFileSync('data.csv', csvData);
console.log('data.csv file has been generated.');
