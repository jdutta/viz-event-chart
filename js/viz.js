(function () {
    let distractedEngagedData = []
    let quizData = []
    let vizEl = null
    let vizWrapperEl = null
    let config = {
        margin: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
        },
        barHeight: 20,
        barGap: 5
    }
    // let engagementDataFile = 'data/distracted_engaged_info.json'
    let engagementDataFile = 'data/5207_time_bounded_all_users_gotcha_times.json'
    // let quizDataFile = 'data/zombie_responses_info.json'
    let quizDataFile = 'data/prez1_ruts_data.json'

    function init() {
        // console.log('init', distractedEngagedData, quizData)
        vizWrapperEl = document.getElementById('vizWrapper')
        vizEl = document.getElementById('viz')
        drawChart({
            engagementData: distractedEngagedData,
            quizData: quizData
        })
    }

    function loadDataFiles() {
        let p1 = d3.json(engagementDataFile).then(data => {
            distractedEngagedData = data
        })
        let p2 = d3.json(quizDataFile).then(data => {
            quizData = data
        })
        return Promise.all([p1, p2])
    }

    function processData(payload) {
        let filteredEngagementData = _.filter(payload.engagementData, o => ['opened', 'closed'].indexOf(o.event) < 0 )
        let userToEngagementData = _.groupBy(filteredEngagementData, o => o.user_id)
        console.log('userToEngagementData', userToEngagementData)
        let minTs = _.min(filteredEngagementData.map(o => new Date(o.start_time).getTime()))
        let maxTs = _.max(filteredEngagementData.map(o => new Date(o.end_time).getTime()))
        console.log('minTs',minTs, maxTs)

        return {
            userToEngagementData,
            users: Object.keys(userToEngagementData),
            minTs,
            maxTs
        }
    }

    function drawChart(payload) {
        let data = processData(payload)

        let margin = config.margin
        let containerSize = {
            w: vizWrapperEl.offsetWidth,
            // w: 3000,
            h: Math.max(vizWrapperEl.offsetHeight, margin.top + margin.bottom + data.users.length * (config.barHeight + config.barGap))
        }

        let width = containerSize.w - margin.left - margin.right
        let height = containerSize.h - margin.top - margin.bottom
        let gRootXY = [margin.left, margin.top]
        // removeChildnodes(vizEl)

        let svg = d3.select(vizEl)
            .attr('width', containerSize.w)
            .attr('height', containerSize.h)
        let gRoot = svg.append('svg:g').attr('transform', 'translate(' + gRootXY + ')')

        let xScale = d3.scaleLinear()
            .domain([data.minTs, data.maxTs])
            .range([0, width])

        data.users.forEach((userId, userIndex) => {
            let engagementData = data.userToEngagementData[userId]
            let gUserEngagement = gRoot.append('svg:g')
                        .classed('user-engagement', true)
                .attr('transform', 'translate('+[0, userIndex * (config.barHeight + config.barGap)]+')')
            gUserEngagement.append('svg:rect')
                .classed('user-timeline', true)
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', width)
                .attr('height', config.barHeight)
            engagementData.forEach(o => {
                let startTs = new Date(o.start_time).getTime()
                let endTs = new Date(o.end_time).getTime()
                let x1 = xScale(startTs)
                let x2 = xScale(endTs)
                if (x2 - x1 < 0) {
                    return
                }
                // console.log('x1 x2', x1, x2)
                let isAttention = o.event === 'attentive'
                gUserEngagement.append('svg:rect')
                    .classed('attention', isAttention)
                    .classed('distraction', !isAttention)
                    .attr('x', x1)
                    .attr('y', 0)
                    .attr('width', x2 - x1)
                    .attr('height', config.barHeight)
                    .append('title')
                    .text(`${isAttention ? 'Attention' : 'Distraction'} span for user ${o.user_id} from ${o.start_time} to ${o.end_time}`)
            })
            gUserEngagement.append('svg:text')
                .attr('x', 0)
                .attr('y', 15)
                .text(`User ${userId}`)
        })
    }

    loadDataFiles().then(init)
})()