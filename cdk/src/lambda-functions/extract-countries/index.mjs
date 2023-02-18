export const handler = async (event) => {
    // TODO implement
    console.log("Event :%j", event);
    let countries = [];
    let count = [];
    let dimensions = [];

    event.cc.forEach(ele => {
        console.log(ele[0].Value);
        countries.push(ele[0].Value);
        dimensions.push([{ Name: "country", Value: ele[0].Value }]);
        count.push(1);
    });

    let response = { "countries": countries, "count": count, "timestamp": "" + new Date().getTime(), "dimensions": dimensions };
    console.log("Response :%j", response);
    return response;
};