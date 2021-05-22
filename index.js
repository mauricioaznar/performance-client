// the node program that caputres local performance data
// and sends it up to the socket.io server

const os = require('os')
const io = require('socket.io-client')
let socket = io('http://127.0.0.1:8181')

console.log(process.env.NODE_ENV)

socket.on('connect', () => {
    // console.log('I connected to the socket server... hooray!')
    // We need a way to identify this machine to whomever concerned
    const nI = os.networkInterfaces()
    let macA
    // loop through all the Ni for this machine and find a non-internal one
    for(let key in nI) {

        // for testing purposes
        macA = Math.floor((Math.random() * 3) + 1)
        break;

        if (nI.hasOwnProperty(key)) {
            if (!nI[key][0].internal) {
                macA = nI[key][0].mac
                break;
            }
        }
    }

    // clientauth with single key value
    socket.emit('clientAuth', '23423')

    performanceData().then(allData => {
        allData.macA = macA
        socket.emit('initPerfData', allData)
    })


    // start sending over data on interval
    let perfDataInterval = setInterval(() => {
        performanceData().then(allData => {
            // console.log(all)
            allData.macA = macA
            socket.emit('perfData', allData)
        })
    }, 1000)

    socket.on('disconnect', () => {
        clearInterval(perfDataInterval)
    })

})


// what do we need to know from node about performance
// cpu load (current)
// meemory usage: free and total
// operating system type
// time the machine ahas been online
// process information
// uptime
// cpu  info
// type
// number of cores
// clock speed

function performanceData () {
    return new Promise(async (resolve, reject) => {
        const cpus = os.cpus()
        const osType = os.type() === 'Darwin' ? 'mac' : os.type()

        const upTime = os.uptime()

        const freemem = os.freemem()

        const totalmem = os.totalmem()

        const usedmem = totalmem - freemem

        const memusage = Math.floor(usedmem/totalmem * 100) / 100

        const cpuModel = cpus[0].model
        const cpuSpeed = cpus[0].speed
        const numCores = cpus.length
        const cpuLoad = await getCpuLoad()
        const isActive = true
        resolve({
            freemem,
            upTime,
            osType,
            totalmem,
            usedmem,
            memusage,
            cpuModel,
            cpuSpeed,
            numCores,
            cpuLoad,
            isActive,
        })
    })
}


// cpus is all numCores, we need the average of all the cores which
// will give us the cpu average

function cpuAverage() {
    const cpusDynamic = os.cpus()
    // get ms in each mode, but this number is since reboot
    // so get it now and get it 100 ms and compare
    let idleMs = 0
    let totalMs = 0
    // loop through each core
    cpusDynamic.forEach((aCore) => {
        // loop through each property of the current core
        for(const type in aCore.times) {
            totalMs += aCore.times[type]
        }
        idleMs += aCore.times.idle
    })
    return {
        idle: idleMs / cpusDynamic.length,
        total: totalMs / cpusDynamic.length
    }
}

// because the times property is time since boot, we will get
// now times, and 100ms from now times. Compare them, that will
// gives us current load
function getCpuLoad() {
    return new Promise(((resolve, reject) => {
        const start = cpuAverage()
        setTimeout(() => {
            const end = cpuAverage()
            const idleDifference = end.idle - start.idle
            const totalDifference = end.total - start.total
            console.log(idleDifference)
            console.log(totalDifference)
            // calc the % of used cpu
            const percentageCpu = 100 - Math.floor(100 * idleDifference / totalDifference)
            resolve(percentageCpu)
        }, 100)
    }))
}

// command to make it crazy
// yes > /dev/null & yes > /dev/null & yes > /dev/null & yes > /dev/nul &
// killall yes
// setInterval(() => {
//     getCpuLoad()
// }, 1000)
