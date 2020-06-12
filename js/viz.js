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
        }
    }

    function init() {
        console.log('init', distractedEngagedData, quizData)
        vizWrapperEl = document.getElementById('vizWrapper')
        vizEl = document.getElementById('viz')
        drawChart()
    }

    function loadDataFiles() {
        let p1 = d3.json('/data/distracted_engaged_info.json').then(data => {
            distractedEngagedData = data
            // distractedEngagedData = _.filter(distractedEngagedData, o => o.event === 'attentive')
            // distractedEngagedData = _.groupBy(distractedEngagedData, o => o.user_id)
        })
        let p2 = d3.json('/data/zombie_responses_info.json').then(data => {
            quizData = data
        })
        return Promise.all([p1, p2])
    }

    function drawChart(containerSize) {
        let data = {}

        containerSize = containerSize || {
            w: vizWrapperEl.offsetWidth,
            h: vizWrapperEl.offsetHeight
        }
        let margin = config.margin

        let width = containerSize.w - margin.left - margin.right
        let height = containerSize.h - margin.top - margin.bottom
        let gRootXY = [margin.left, margin.top]
        // removeChildnodes(vizEl)

        let svg = d3.select(vizEl)
            .attr('width', containerSize.w)
            .attr('height', containerSize.h)
        let gRoot = svg.append('svg:g').attr('transform', 'translate(' + gRootXY + ')')
    }

    loadDataFiles().then(init)
})()