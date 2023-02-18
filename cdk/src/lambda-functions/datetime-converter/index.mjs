export const handler = async (event) => {
    console.log(event);
    let now = new Date().getTime();
    let dateOffset = (24 * 60 * 60 * 1000) * 1; //7 days

    return { startTime: now - dateOffset, endTime: now };
};
