import axios from "axios";

const defaultOptions = {
  required: true,
};

export default function checkUser(options = defaultOptions) {
  return async (ctx, next) => {
    // set user.id to 0 so it's always available even if there is no user.
    ctx.state.user = {
      id: 0,
    };

    const token = ctx.cookies.get("github-token");

    // for some requests we don't want to force the user to login, so they can
    // continue through
    if (!token) {
      if (!options.required) {
        return next();
      }
      ctx.throw(403);
    }

    const user = ctx.cache.get(token);

    // cache hit, nothing more to do.
    if (user) {
      ctx.state.user = user;
      return next();
    }

    const basicAuthString = Buffer.from(
      `${process.env.GITHUB_CLIENT}:${process.env.GITHUB_SECRET}`
    ).toString("base64");

    const body = { access_token: token };

    try {
      const { data } = await axios.post(
        `https://api.github.com/applications/${process.env.GITHUB_CLIENT}/token`,
        body,
        { headers: { Authorization: `Basic ${basicAuthString}` } }
      );

      await ctx.db.raw(
        "replace user (id, login, avatar_url) values (?, ?, ?)",
        [data.user.id, data.user.login, data.user.avatar_url]
      );

      ctx.cache.set(token, data.user);
      ctx.state.user = data.user;

      return next();
    } catch (e) {
      console.error(e.message);
      ctx.throw(403);
    }
  };
}
