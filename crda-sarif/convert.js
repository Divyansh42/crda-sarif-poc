var fs = require('fs');


var sarif_template =
{
    "version": "2.1.0",
    "runs": [
        {
            "originalUriBaseIds": {
                "PROJECTROOT": {
                    "uri": "file:///github/workspace/",
                    "description": {
                        "text": "The root directory for all project files."
                    }
                }
            },
            "tool": {
                "driver": {
                    "name": "CRDA",
                    "rules": []
                }
            },
            "results": []
        }
    ]
};


var args = process.argv.splice(2);
if (args.length < 1) {
    console.log("You must pass crda json file");
    console.log("Usage:", process.argv[0], " input-file optional-output-file(default == output.sarif)");
    process.exit(0);
}
var crda = args[0]
var outputFile = "output.sarif";
if (args.length > 1) {
    outputFile = args[1]
    console.log("outputFile set to:", outputFile);
}

//set or get rules
function srules(sarif, optional_set) {
    if (optional_set) { sarif.runs[0].tool.driver.rules = optional_set }
    return sarif.runs[0].tool.driver.rules
}
function sresults(sarif, optional_set) {
    if (optional_set) { sarif.runs[0].results = optional_set }
    return sarif.runs[0].results
}


function crda_to_rule(e) {
    var r = {}
    r.id = e.id;
    r.shortDescription = { "text": e.title };
    r.fullDescription = { "text": e.title };
    r.help = { "text": "text for help", "markdown": "markdown ***text for help" };
    var sev = "none";
    if (e.severity == "medium") sev = "warning";
    if (e.severity == "high") sev = "error";
    if (e.severity == "critical") sev = "error";

    r.defaultConfiguration = { "level": sev };
    r.properties = { "tags": [] }
    return r;
}

function crda_to_result(e, packageJson) {
    var r = null;
    if (e.commonly_known_vulnerabilities) { 
        var lines = packageJson.split(/\r\n|\n/);
        var index = lines.findIndex (function (s,i,a) { 
            return s.includes(e.name)})
        
        r =  {}
        r.ruleId = e.commonly_known_vulnerabilities[0].id;
        r.message = {
            "text": e.commonly_known_vulnerabilities[0].title
        }
        r.locations = [{
            "physicalLocation": {
                "artifactLocation": {
                    "uri": "package.json",
                    "uriBaseId": "PROJECTROOT"
                },
                "region": {
                    "startLine": index+1
                }
            }
        }];
    }
    return r;
}



function mergeSarif(d1, packageJson) {
    console.log(outputFile + " rules found: ", srules(sarif_template).length)
    console.log(outputFile + " locations found: ", sresults(sarif_template).length)
    var crda = JSON.parse(d1)
    var newRules = []
    var f = function (e) { newRules.push(crda_to_rule(e)) }
    if (crda.severity.low)
        crda.severity.low.forEach(f)
    if (crda.severity.medium)
        crda.severity.medium.forEach(f)
    if (crda.severity.high)
        crda.severity.high.forEach(f)
    if (crda.severity.critical)
        crda.severity.critical.forEach(f)
    console.log("Number of rules combined is: ", newRules.length)
    srules(sarif_template, newRules);
    var results = []
    crda.analysed_dependencies.forEach(
        function (e) { 
            var hasResult = crda_to_result(e, packageJson);
            if (hasResult) results.push(hasResult) 
        }
    )
    sresults(sarif_template, results)
    console.log(outputFile + " rules found: ", srules(sarif_template).length)
    console.log(outputFile + " locations found: ", sresults(sarif_template).length)
    return sarif_template;
}

fs.readFile("package.json", 'utf8', function (err, packageData) {
    fs.readFile(crda, 'utf8', function (err, crdaData) {
        var sarif = mergeSarif(crdaData, packageData)
        writeJSON(outputFile, sarif, process.exit)
    })
})

function writeJSON(file, value, then) {
    var stream = fs.createWriteStream(file);
    stream.once('open', function (fd) {
        stream.write(JSON.stringify(value));
        stream.end();
        console.log("Created: ", file);
        then(0)
    });
}